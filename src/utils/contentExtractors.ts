import { load } from 'cheerio';
import { generateObject } from 'ai';
import { bedrock } from '@ai-sdk/amazon-bedrock';
import { z } from 'zod';
import { validateCanonicalTag } from './seoHelpers';

export function extractTechnicalSeo(html: string, metaData: Record<string, string>, url: string) {
  const urlObj = new URL(url);

  // Sitemap
  const sitemapMatch = html.match(/<link[^>]*rel=["']sitemap["'][^>]*href=["']([^"']+)["']/i);
  const sitemapXml = {
    present: !!sitemapMatch,
    url: sitemapMatch ? sitemapMatch[1] : undefined
  };

  // Robots.txt
  const robotsTxt = {
    present: true,
    allows: ['*']
  };

  // Canonical tag
  const canonicalMatch = validateCanonicalTag(html);
  const canonicalTag = { 
    present: !!canonicalMatch,
    url: undefined
  };

  // Schema markup
  const schemaMatches = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  const schemaTypes: string[] = [];
  if (schemaMatches) {
    schemaMatches.forEach(match => {
      try {
        const jsonMatch = match.match(/<script[^>]*>([\s\S]*?)<\/script>/i);
        if (jsonMatch) {
          const schema = JSON.parse(jsonMatch[1]);
          if (schema['@type']) {
            schemaTypes.push(schema['@type']);
          }
        }
      } catch (e) {}
    });
  }

  const schemaMarkup = {
    present: schemaTypes.length > 0,
    types: schemaTypes.length > 0 ? schemaTypes : undefined,
    canBeAdded: schemaTypes.length === 0 ? ['Organization', 'WebSite', 'WebPage'] : undefined
  };

  // Meta tags
  const metaTags = {
    title: metaData.title,
    description: metaData.description
  };

  return {
    sitemapXml,
    robotsTxt,
    canonicalTag,
    schemaMarkup,
    metaTags,
    httpStatus: 200
  };
}

export function extractLinks(html: string, baseUrl: string) {
  const urlObj = new URL(baseUrl);
  const hostname = urlObj.hostname;
  
  const linkMatches = html.match(/<a[^>]*href=["']([^"']+)["']/gi) || [];
  
  let internalCount = 0;
  let externalCount = 0;

  linkMatches.forEach(link => {
    const hrefMatch = link.match(/href=["']([^"']+)["']/i);
    if (hrefMatch) {
      const href = hrefMatch[1];
      if (href.startsWith('http')) {
        const linkUrl = new URL(href);
        if (linkUrl.hostname === hostname) {
          internalCount++;
        } else {
          externalCount++;
        }
      } else if (href.startsWith('/') || !href.startsWith('#')) {
        internalCount++;
      }
    }
  });

  const getRecommendation = (count: number, type: 'internal' | 'external'): "low" | "good" | "high" => {
    if (type === 'internal') {
      if (count < 10) return 'low';
      if (count > 100) return 'high';
      return 'good';
    } else {
      if (count < 3) return 'low';
      if (count > 50) return 'high';
      return 'good';
    }
  };

  return {
    internal: {
      count: internalCount,
      recommendation: getRecommendation(internalCount, 'internal')
    },
    external: {
      count: externalCount,
      recommendation: getRecommendation(externalCount, 'external')
    }
  };
}

export function extractImages(html: string) {
  const imgMatches = html.match(/<img[^>]*>/gi) || [];
  
  const missingAltDetails: Array<{ src: string; alt?: string }> = [];
  let withAltText = 0;
  let withoutAltText = 0;

  imgMatches.forEach(img => {
    const srcMatch = img.match(/src=["']([^"']+)["']/i);
    const altMatch = img.match(/alt=["']([^"']*)["']/i);
    const src = srcMatch ? srcMatch[1] : '';
    const alt = altMatch ? altMatch[1] : undefined;

    if (alt && alt.trim()) {
      withAltText++;
    } else {
      withoutAltText++;
      missingAltDetails.push({ src, alt });
    }
  });

  return {
    total: imgMatches.length,
    withAltText,
    withoutAltText,
    missingAltDetails: missingAltDetails.slice(0, 10)
  };
}

export async function validateAndImproveSchema(url: string) {
  try {
    const response = await fetch('https://validator.schema.org/validate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `url=${encodeURIComponent(url)}`
    });

    if (!response.ok) {
      console.error('Schema validation API error:', response.statusText);
      return null;
    }

    const text = await response.text();
    const cleaned = text.replace(/^\)\]\}'\n/, '');
    const pageData = JSON.parse(cleaned);
    
    const $ = load(pageData.html);
    
    // Extract schema information
    const schemaScripts = $('script[type="application/ld+json"]');
    const schemas: string[] = [];
    schemaScripts.each((i, elem) => {
      const content = $(elem).html();
      if (content) {
        schemas.push(content);
      }
    });

    // Extract error and warning messages
    const errors: string[] = [];
    const warnings: string[] = [];
    
    $('[class*="error"]').each((i, elem) => {
      const text = $(elem).text().trim();
      if (text && errors.length < 5) {
        errors.push(text);
      }
    });

    $('[class*="warning"]').each((i, elem) => {
      const text = $(elem).text().trim();
      if (text && warnings.length < 5) {
        warnings.push(text);
      }
    });

    // Extract validation status
    const validationText = $('body').text();
    const extractedData = {
      schemas: schemas,
      errors: errors,
      warnings: warnings,
      validationText: validationText.substring(0, 2000)
    };
    
    // Send the extracted content to LLM for analysis
    try {
      const result = await generateObject({
        model: bedrock('global.anthropic.claude-haiku-4-5-20251001-v1:0'),
        schema: z.object({
          valid: z.boolean().describe("Whether the schema markup is valid"),
          errors: z.number().describe("Number of validation errors found"),
          warnings: z.number().describe("Number of validation warnings found"),
          currentSchema: z.string().describe("The exact current schema markup found on the page as JSON with formatted spaces for better readability"),
          improvements: z.array(
            z.string()
          ).describe("List of specific improvements that can be made to the schema markup")
        }),
        prompt: `Analyze this schema.org validation data and extract key information.

Extracted Schema Markup:
${extractedData.schemas.join('\n\n')}

Errors Found:
${extractedData.errors.join('\n') || 'None'}

Warnings Found:
${extractedData.warnings.join('\n') || 'None'}

Validation Text (excerpt):
${extractedData.validationText}

Extract:
1. Whether schema is valid (true if no errors, false otherwise)
2. Count of validation errors
3. Count of validation warnings
4. The exact current schema markup with spaces formatted
5. A list of 2-3 specific improvements that can be made to enhance the schema

Return the currentSchema as valid, parseable JSON and improvements as specific actionable changes.`
      });

      return {
        valid: result.object.valid,
        errors: result.object.errors,
        warnings: result.object.warnings,
        currentSchema: schemas.join("/n/n"),
        improvements: result.object.improvements
      };
    } catch (llmError) {
      console.error('Error analyzing schema validation with AI:', llmError);
      return null;
    }
  } catch (error) {
    console.error('Error validating schema:', error);
    return null;
  }
}