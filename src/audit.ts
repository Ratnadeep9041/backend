// import Firecrawl from "@mendable/firecrawl-js";
// import psi from 'psi';
// import { generateObject } from 'ai';
// import { bedrock } from '@ai-sdk/amazon-bedrock';
// import { z } from 'zod';
// import { load } from 'cheerio';
// import { AuditResponse } from "./types";

// const firecrawl = new Firecrawl({
//   apiKey: process.env.FIRECRAWL_API_KEY || "",
// });

// const improvementSchema = z.object({
//   headline: z.string().describe("Concise, actionable headline (max 10 words)"),
//   description: z.string().describe("Simple, easy-to-understand explanation"),
//   priority: z.enum(['high', 'medium', 'low']).describe("Priority level based on impact")
// });

// const improvementsSchema = z.object({
//   improvements: z.array(improvementSchema)
// });

// const robotsValidationSchema = z.object({
//   allowed: z.boolean().describe("Whether the URL is allowed by robots.txt")
// });

// const schemaImprovementSchema = z.object({
//   improvements: z.array(
//     z.object({
//       headline: z.string().describe("Concise improvement headline (max 10 words)"),
//       description: z.string().describe("Simple explanation of the improvement"),
//       priority: z.enum(['high', 'medium', 'low']).describe("Priority level based on impact")
//     })
//   ),
//   formattedSchema: z.string().describe("Properly formatted and enhanced schema markup")
// });

// export async function auditWebsite(url: string): Promise<AuditResponse> {
//   // Run PageSpeed Insights
//   const apiKey = process.env.PSI_API_KEY;

//   const [mobileResults, desktopResults] = await Promise.all([
//     psi(url, {
//       strategy: 'mobile',
//       key: apiKey,
//       // @ts-ignore
//       category: ['performance', 'accessibility', 'best-practices', 'seo']
//     }),
//     psi(url, {
//       strategy: 'desktop',
//       key: apiKey,
//       // @ts-ignore
//       category: ['performance', 'accessibility', 'best-practices', 'seo']
//     })
//   ]);

//   const performanceScore = Math.round(
//     (Number(desktopResults.data.lighthouseResult.categories.performance.score) * 100 +
//      Number(mobileResults.data.lighthouseResult.categories.performance.score) * 100) / 2
//   );

//   // Get average scores
//   const accessibilityScore = Math.round(
//     (Number(desktopResults.data.lighthouseResult.categories.accessibility.score) * 100 +
//      Number(mobileResults.data.lighthouseResult.categories.accessibility.score) * 100) / 2
//   );
  
//   const seoScore = Math.round(
//     (Number(desktopResults.data.lighthouseResult.categories.seo.score) * 100 +
//      Number(mobileResults.data.lighthouseResult.categories.seo.score) * 100) / 2
//   );
  
//   const bestPracticesScore = Math.round(
//     (Number(desktopResults.data.lighthouseResult.categories['best-practices'].score) * 100 +
//      Number(mobileResults.data.lighthouseResult.categories['best-practices'].score) * 100) / 2
//   );

//   const urlObj = new URL(url);
//   const baseUrl = `${urlObj.protocol}//${urlObj.hostname}`;
//   const robotsTxtContent = await fetchRobotsTxt(baseUrl);
//   const sitemapUrl = await discoverSitemap(baseUrl);
//   const sitemapContent = sitemapUrl ? await fetchSitemapContent(sitemapUrl) : null;

//   // Check if URL is in sitemap
//   let sitemapPresent = false;
//   if (sitemapContent) {
//     const urlObjForSitemap = new URL(url);
//     const pathWithQuery = urlObjForSitemap.pathname + urlObjForSitemap.search;
//     sitemapPresent = sitemapContent.includes(url) || sitemapContent.includes(pathWithQuery);
//   }

//   // Validate URL against robots.txt using LLM
//   let robotsTextPresent = true;
//   if (robotsTxtContent) {
//     try {
//       const result = await generateObject({
//         model: bedrock('global.anthropic.claude-haiku-4-5-20251001-v1:0'),
//         schema: robotsValidationSchema,
//         prompt: `Analyze this robots.txt file and determine if the URL "${url}" is allowed to be crawled.

// robots.txt content:
// ${robotsTxtContent}

// Return true if the URL is allowed, false if it's disallowed. Consider all user-agent rules, disallow/allow directives, and wildcards.`
//       });
//       robotsTextPresent = result.object.allowed;
//     } catch (error) {
//       console.error('Error validating URL with LLM:', error);
//       robotsTextPresent = true;
//     }
//   }

//   // Scrape page with Firecrawl
//   const scrapeResult = await firecrawl.scrape(url, {
//     formats: ["markdown", "html"],
//   });

//   // Parse HTML for technical SEO
//   const html = scrapeResult.html || '';
//   const metaData = scrapeResult?.metadata as Record<string, string>;
//   const technical = extractTechnicalSeo(html, metaData, url);

//   // Extract links
//   const links = extractLinks(html, url);

//   // Extract images
//   const images = extractImages(html);

//   // Validate and improve schema markup
//   const schemaAnalysis = await validateAndImproveSchema(url);

//   const improvementsByCategory = await extractAuditImprovementsWithAI(
//     desktopResults.data.lighthouseResult.audits,
//     mobileResults.data.lighthouseResult.audits,
//     { performanceScore, accessibilityScore, seoScore, bestPracticesScore }
//   );

//   const improvedMeta = await generateOptimizedMeta(
//     technical.metaTags.title,
//     technical.metaTags.description,
//     url
//   );

//   console.log({improvedMeta, sitemapPresent, robotsTextPresent, schemaAnalysis})

//   return {
//     url,
//     timestamp: new Date().toISOString(),
//     technical: {
//       sitemapPresent: !!sitemapUrl,
//       robotsTextPresent: !!robotsTxtContent,
//       canonicalTagPresent: technical.canonicalTag.present,
//       schemaMarkup: technical.schemaMarkup.types || [],
//       schemaValidation: schemaAnalysis,
//       statusCodes: {
//         code4xx: 0,
//         code3xx: 0
//       },
//     },
//     performance: {
//       score: performanceScore,
//       improvements: improvementsByCategory.performance
//     },
//     accessibility: {
//       score: accessibilityScore,
//       issues: improvementsByCategory.accessibility
//     },
//     seo: {
//       score: seoScore,
//       improvements: improvementsByCategory.seo
//     },
//     bestPractices: {
//       score: bestPracticesScore,
//       issues: improvementsByCategory.bestPractices
//     },
//     links: {
//       internal: links.internal.count,
//       external: links.external.count,
//       recommendedInternal: links.internal.recommendation === 'good' ? links.internal.count : (links.internal.recommendation === 'low' ? 50 : 20),
//       recommendedExternal: links.external.recommendation === 'good' ? links.external.count : (links.external.recommendation === 'low' ? 10 : 20)
//     },
//     images: {
//       total: images.total,
//       withoutAltText: images.withoutAltText,
//       locations: images.missingAltDetails,
//     },
//     url_improvements: {
//       original: url,
//       improved: url
//     },
//     meta: {
//       original: {
//         title: technical.metaTags.title || '',
//         description: technical.metaTags.description || ''
//       },
//       improved: improvedMeta
//     },
//     html
//   };
// }

// async function fetchRobotsTxt(baseUrl: string): Promise<string | null> {
//   try {
//     const response = await fetch(`${baseUrl}/robots.txt`);
//     if (response.ok) {
//       return await response.text();
//     }
//   } catch (e) {
//     console.error('Error fetching robots.txt:', e);
//   }
//   return null;
// }

// async function discoverSitemap(baseUrl: string): Promise<string | null> {
//   try {
//     const sitemapUrls = [
//       `${baseUrl}/sitemap.xml`,
//       `${baseUrl}/sitemap.txt`,
//       `${baseUrl}/sitemap-index.xml`
//     ];

//     for (const sitemapUrl of sitemapUrls) {
//       const response = await fetch(sitemapUrl);
//       if (response.ok) {
//         return sitemapUrl;
//       }
//     }
//   } catch (e) {
//     console.error('Error discovering sitemap:', e);
//   }
//   return null;
// }

// async function validateCanonicalTag(scrapeResult: any): Promise<boolean> {
//   try {
//     const html = scrapeResult.html || '';
//     const markdown = scrapeResult.markdown || '';
    
//     // Use LLM to analyze if canonical tag exists
//     const result = await generateObject({
//       model: bedrock('global.anthropic.claude-haiku-4-5-20251001-v1:0'),
//       schema: z.object({
//         canonicalExists: z.boolean().describe("Whether a canonical tag exists in the page")
//       }),
//       prompt: `Analyze this HTML and markdown content to determine if a canonical tag exists on the page.

// HTML Content:
// ${html.substring(0, 2000)}

// Markdown Content:
// ${markdown.substring(0, 2000)}

// Check for:
// 1. <link rel="canonical" href="..."> in the HTML head
// 2. Any canonical URL references

// Return true if a canonical tag is present, false otherwise.`
//     });
    
//     return result.object.canonicalExists;
//   } catch (error) {
//     console.error('Error validating canonical tag:', error);
//     // Fallback to regex check
//     const html = scrapeResult.html || '';
//     const canonicalMatch = html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i);
//     return !!canonicalMatch;
//   }
// }

// async function fetchSitemapContent(sitemapUrl: string): Promise<string | null> {
//   try {
//     const response = await fetch(sitemapUrl);
//     if (response.ok) {
//       return await response.text();
//     }
//   } catch (e) {
//     console.error('Error fetching sitemap:', e);
//   }
//   return null;
// }

// async function validateAndImproveSchema(url: string) {
//   try {
//     const response = await fetch('https://validator.schema.org/validate', {
//       method: 'POST',
//       headers: {
//         'Content-Type': 'application/x-www-form-urlencoded',
//       },
//       body: `url=${encodeURIComponent(url)}`
//     });

//     if (!response.ok) {
//       console.error('Schema validation API error:', response.statusText);
//       return null;
//     }
//     const text = await response.text();
//     const cleaned = text.replace(/^\)\]\}'\n/, '');
//     const pageData = JSON.parse(cleaned);
    
//     const $ = load(pageData.html);
//     // Extract schema information
//     const schemaScripts = $('script[type="application/ld+json"]');
//     const schemas: string[] = [];
//     schemaScripts.each((i, elem) => {
//       const content = $(elem).html();
//       if (content) {
//         schemas.push(content);
//       }
//     });

//     // Extract error and warning messages
//     const errors: string[] = [];
//     const warnings: string[] = [];
    
//     // Look for error elements
//     $('[class*="error"]').each((i, elem) => {
//       const text = $(elem).text().trim();
//       if (text && errors.length < 5) {
//         errors.push(text);
//       }
//     });

//     // Look for warning elements
//     $('[class*="warning"]').each((i, elem) => {
//       const text = $(elem).text().trim();
//       if (text && warnings.length < 5) {
//         warnings.push(text);
//       }
//     });

//     // Extract validation status
//     const validationText = $('body').text();
//     const isValid = !validationText.includes('error') && errors.length === 0;

//     const extractedData = {
//       schemas: schemas,
//       errors: errors,
//       warnings: warnings,
//       validationText: validationText.substring(0, 2000)
//     };
    
//     // Send the extracted content to LLM for analysis
//     try {
//       const result = await generateObject({
//         model: bedrock('global.anthropic.claude-haiku-4-5-20251001-v1:0'),
//         schema: z.object({
//           valid: z.boolean().describe("Whether the schema markup is valid"),
//           errors: z.number().describe("Number of validation errors found"),
//           warnings: z.number().describe("Number of validation warnings found"),
//           currentSchema: z.string().describe("The exact current schema markup found on the page as JSON with formatted spaces for better readability"),
//           improvements: z.array(
//             z.string()
//           ).describe("List of specific improvements that can be made to the schema markup")
//         }),
//         prompt: `Analyze this schema.org validation data and extract key information.

// Extracted Schema Markup:
// ${extractedData.schemas.join('\n\n')}

// Errors Found:
// ${extractedData.errors.join('\n') || 'None'}

// Warnings Found:
// ${extractedData.warnings.join('\n') || 'None'}

// Validation Text (excerpt):
// ${extractedData.validationText}

// Extract:
// 1. Whether schema is valid (true if no errors, false otherwise)
// 2. Count of validation errors
// 3. Count of validation warnings
// 4. The exact current schema markup with spaces formatted
// 5. A list of 2-3 specific improvements that can be made to enhance the schema

// Return the currentSchema as valid, parseable JSON and improvements as specific actionable changes.`
//       });

//       return {
//         valid: result.object.valid,
//         errors: result.object.errors,
//         warnings: result.object.warnings,
//         currentSchema: schemas.join("/n/n"),
//         improvements: result.object.improvements
//       };
//     } catch (llmError) {
//       console.error('Error analyzing schema validation with AI:', llmError);
//       return null;
//     }


//   } catch (error) {
//     console.error('Error validating schema:', error);
//     return null;
//   }
// }

// function extractTechnicalSeo(html: string, metaData: Record<string, string>, url: string) {
//   const urlObj = new URL(url);
//   const baseUrl = `${urlObj.protocol}//${urlObj.hostname}`;

//   // Sitemap
//   const sitemapMatch = html.match(/<link[^>]*rel=["']sitemap["'][^>]*href=["']([^"']+)["']/i);
//   const sitemapXml = {
//     present: !!sitemapMatch,
//     url: sitemapMatch ? sitemapMatch[1] : undefined
//   };

//   // Robots.txt
//   const robotsTxt = {
//     present: true,
//     allows: ['*']
//   };

//   // Canonical tag
//   const canonicalMatch = validateCanonicalTag(html)
  
//   const canonicalTag = { 
//     present: !!canonicalMatch,
//     url: undefined
//   };

//   // Schema markup
//   const schemaMatches = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
//   const schemaTypes: string[] = [];
//   if (schemaMatches) {
//     schemaMatches.forEach(match => {
//       try {
//         const jsonMatch = match.match(/<script[^>]*>([\s\S]*?)<\/script>/i);
//         if (jsonMatch) {
//           const schema = JSON.parse(jsonMatch[1]);
//           if (schema['@type']) {
//             schemaTypes.push(schema['@type']);
//           }
//         }
//       } catch (e) {}
//     });
//   }

//   const schemaMarkup = {
//     present: schemaTypes.length > 0,
//     types: schemaTypes.length > 0 ? schemaTypes : undefined,
//     canBeAdded: schemaTypes.length === 0 ? ['Organization', 'WebSite', 'WebPage'] : undefined
//   };

//   // Meta tags
//   const metaTags = {
//     title: metaData.title,
//     description: metaData.description
//   };

//   return {
//     sitemapXml,
//     robotsTxt,
//     canonicalTag,
//     schemaMarkup,
//     metaTags,
//     httpStatus: 200
//   };
// }

// function extractLinks(html: string, baseUrl: string) {
//   const urlObj = new URL(baseUrl);
//   const hostname = urlObj.hostname;
  
//   const linkMatches = html.match(/<a[^>]*href=["']([^"']+)["']/gi) || [];
  
//   let internalCount = 0;
//   let externalCount = 0;

//   linkMatches.forEach(link => {
//     const hrefMatch = link.match(/href=["']([^"']+)["']/i);
//     if (hrefMatch) {
//       const href = hrefMatch[1];
//       if (href.startsWith('http')) {
//         const linkUrl = new URL(href);
//         if (linkUrl.hostname === hostname) {
//           internalCount++;
//         } else {
//           externalCount++;
//         }
//       } else if (href.startsWith('/') || !href.startsWith('#')) {
//         internalCount++;
//       }
//     }
//   });

//   const getRecommendation = (count: number, type: 'internal' | 'external'): "low" | "good" | "high" => {
//     if (type === 'internal') {
//       if (count < 10) return 'low';
//       if (count > 100) return 'high';
//       return 'good';
//     } else {
//       if (count < 3) return 'low';
//       if (count > 50) return 'high';
//       return 'good';
//     }
//   };

//   return {
//     internal: {
//       count: internalCount,
//       recommendation: getRecommendation(internalCount, 'internal')
//     },
//     external: {
//       count: externalCount,
//       recommendation: getRecommendation(externalCount, 'external')
//     }
//   };
// }

// function extractImages(html: string) {
//   const imgMatches = html.match(/<img[^>]*>/gi) || [];
  
//   const missingAltDetails: Array<{ src: string; alt?: string }> = [];
//   let withAltText = 0;
//   let withoutAltText = 0;

//   imgMatches.forEach(img => {
//     const srcMatch = img.match(/src=["']([^"']+)["']/i);
//     const altMatch = img.match(/alt=["']([^"']*)["']/i);
//     const src = srcMatch ? srcMatch[1] : '';
//     const alt = altMatch ? altMatch[1] : undefined;

//     if (alt && alt.trim()) {
//       withAltText++;
//     } else {
//       withoutAltText++;
//       missingAltDetails.push({ src, alt });
//     }
//   });

//   return {
//     total: imgMatches.length,
//     withAltText,
//     withoutAltText,
//     missingAltDetails: missingAltDetails.slice(0, 10)
//   };
// }

// async function extractAuditImprovementsWithAI(
//   desktopAudits: any,
//   mobileAudits: any,
//   scores: any
// ) {
//   const processCategory = async (audits: any, categoryName: string) => {
//     const failingAudits: Array<{ title: string; description: string; displayValue?: string }> = [];

//     Object.entries(audits).forEach(([auditId, audit]: any) => {
//       if (audit.score < 1 && audit.score !== null && audit.title && audit.description) {
//         failingAudits.push({
//           title: audit.title,
//           description: audit.description,
//           displayValue: audit.displayValue
//         });
//       }
//     });

//     if (failingAudits.length === 0) {
//       return [];
//     }

//     const auditSummary = failingAudits
//       .slice(0, 10)
//       .map(a => `${a.title}: ${a.description}${a.displayValue ? ` (${a.displayValue})` : ''}`)
//       .join('\n');

//     try {
//       const result = await generateObject({
//         model: bedrock('global.anthropic.claude-haiku-4-5-20251001-v1:0'),
//         schema: improvementsSchema,
//         prompt: `You are an SEO and web optimization expert. Convert Lighthouse audit findings into simple, actionable improvements that are ONLY relevant to the specified category.

//         Category: ${categoryName}
        
//         IMPORTANT: Only include improvements that directly relate to the "${categoryName}" category. Ignore any audit findings that are not related to this specific category.
        
//         Lighthouse Findings:
//         ${auditSummary}
        
//         Generate 3-5 of the most impactful improvements that apply to ${categoryName}. For each improvement:
//         - Use a clear headline (max 10 words)
//         - Write a simple explanation that a non-technical person can understand
//         - Ensure it's directly relevant to ${categoryName}
        
//         Discard any findings that fall outside the ${categoryName} scope.`
//       });

//       return result.object.improvements.map(imp => `${imp.headline} - ${imp.description}`);
//     } catch (error) {
//       console.error(`Error processing ${categoryName} with AI:`, error);
//       return failingAudits.slice(0, 5).map(a => `${a.title}: ${a.description}`);
//     }
//   };

//   const [performance, accessibility, seo, bestPractices] = await Promise.all([
//     processCategory(desktopAudits, 'Performance'),
//     processCategory(desktopAudits, 'Accessibility'),
//     processCategory(desktopAudits, 'SEO'),
//     processCategory(desktopAudits, 'Best Practices')
//   ]);
  
//   return { performance, accessibility, seo, bestPractices };
// }

// async function generateOptimizedMeta(
//   originalTitle: string | undefined,
//   originalDescription: string | undefined,
//   url: string
// ) {
//   if (!originalTitle && !originalDescription) {
//     return {
//       title: 'Optimized Page Title',
//       description: 'Optimized page description'
//     };
//   }

//   try {
//     const result = await generateObject({
//       model: bedrock('global.anthropic.claude-haiku-4-5-20251001-v1:0'),
//       schema: z.object({
//         title: z.string().max(60).describe("SEO-optimized meta title (max 60 chars)"),
//         description: z.string().max(160).describe("SEO-optimized meta description (max 160 chars)")
//       }),
//       prompt: `Generate an SEO-optimized meta title and description for a webpage.

// Current Title: ${originalTitle || 'Not provided'}
// Current Description: ${originalDescription || 'Not provided'}
// URL: ${url}

// Create an improved version that:
// - Title: Clear, keyword-rich, max 60 characters
// - Description: Compelling, includes call-to-action, max 160 characters
// - Both should be improvements over the originals while being realistic and professional`
//     });
    
//     return {
//       title: result.object.title,
//       description: result.object.description
//     };
//   } catch (error) {
//     console.error('Error generating optimized meta with AI:', error);
//     return {
//       title: originalTitle ? `${originalTitle.substring(0, 55)}...` : 'Optimized Title',
//       description: originalDescription ? `${originalDescription.substring(0, 155)}...` : 'Optimized description'
//     };
//   }
// }


import Firecrawl from "@mendable/firecrawl-js";
import psi from 'psi';
import { AuditResponse } from "./types";
import { fetchRobotsTxt, discoverSitemap, fetchSitemapContent, validateUrlAgainstRobots } from "./utils/seoHelpers"
import { extractTechnicalSeo, extractLinks, extractImages, validateAndImproveSchema } from "./utils/contentExtractors"
import { extractAuditImprovementsWithAI, generateOptimizedMeta } from "./utils/aiHelpers"

const firecrawl = new Firecrawl({
  apiKey: process.env.FIRECRAWL_API_KEY || "",
});

export async function auditWebsite(url: string): Promise<AuditResponse> {
  // Run PageSpeed Insights
  const apiKey = process.env.PSI_API_KEY;

  const [mobileResults, desktopResults] = await Promise.all([
    psi(url, {
      strategy: 'mobile',
      key: apiKey,
      // @ts-ignore
      category: ['performance', 'accessibility', 'best-practices', 'seo']
    }),
    psi(url, {
      strategy: 'desktop',
      key: apiKey,
      // @ts-ignore
      category: ['performance', 'accessibility', 'best-practices', 'seo']
    })
  ]);

  // Calculate average scores
  const performanceScore = Math.round(
    (Number(desktopResults.data.lighthouseResult.categories.performance.score) * 100 +
     Number(mobileResults.data.lighthouseResult.categories.performance.score) * 100) / 2
  );

  const accessibilityScore = Math.round(
    (Number(desktopResults.data.lighthouseResult.categories.accessibility.score) * 100 +
     Number(mobileResults.data.lighthouseResult.categories.accessibility.score) * 100) / 2
  );
  
  const seoScore = Math.round(
    (Number(desktopResults.data.lighthouseResult.categories.seo.score) * 100 +
     Number(mobileResults.data.lighthouseResult.categories.seo.score) * 100) / 2
  );
  
  const bestPracticesScore = Math.round(
    (Number(desktopResults.data.lighthouseResult.categories['best-practices'].score) * 100 +
     Number(mobileResults.data.lighthouseResult.categories['best-practices'].score) * 100) / 2
  );

  // Fetch SEO-related resources
  const urlObj = new URL(url);
  const baseUrl = `${urlObj.protocol}//${urlObj.hostname}`;
  const robotsTxtContent = await fetchRobotsTxt(baseUrl);
  const sitemapUrl = await discoverSitemap(baseUrl);
  const sitemapContent = sitemapUrl ? await fetchSitemapContent(sitemapUrl) : null;

  // Check if URL is in sitemap
  let sitemapPresent = false;
  if (sitemapContent) {
    const urlObjForSitemap = new URL(url);
    const pathWithQuery = urlObjForSitemap.pathname + urlObjForSitemap.search;
    sitemapPresent = sitemapContent.includes(url) || sitemapContent.includes(pathWithQuery);
  }

  // Validate URL against robots.txt
  const robotsTextPresent = await validateUrlAgainstRobots(url, robotsTxtContent);

  // Scrape page with Firecrawl
  const scrapeResult = await firecrawl.scrape(url, {
    formats: ["markdown", "html"],
  });

  // Parse HTML for technical SEO
  const html = scrapeResult.html || '';
  const metaData = scrapeResult?.metadata as Record<string, string>;
  const technical = extractTechnicalSeo(html, metaData, url);

  // Extract links and images
  const links = extractLinks(html, url);
  const images = extractImages(html);

  // Validate and improve schema markup
  const schemaAnalysis = await validateAndImproveSchema(url);

  // Extract audit improvements using AI
  const improvementsByCategory = await extractAuditImprovementsWithAI(
    desktopResults.data.lighthouseResult.audits,
    mobileResults.data.lighthouseResult.audits,
    { performanceScore, accessibilityScore, seoScore, bestPracticesScore }
  );

  // Generate optimized meta tags
  const improvedMeta = await generateOptimizedMeta(
    technical.metaTags.title,
    technical.metaTags.description,
    url
  );

  console.log({improvedMeta, sitemapPresent, robotsTextPresent, schemaAnalysis})

  return {
    url,
    timestamp: new Date().toISOString(),
    technical: {
      sitemapPresent: !!sitemapUrl,
      robotsTextPresent: !!robotsTxtContent,
      canonicalTagPresent: technical.canonicalTag.present,
      schemaMarkup: technical.schemaMarkup.types || [],
      schemaValidation: schemaAnalysis,
      statusCodes: {
        code4xx: 0,
        code3xx: 0
      },
    },
    performance: {
      score: performanceScore,
      improvements: improvementsByCategory.performance
    },
    accessibility: {
      score: accessibilityScore,
      issues: improvementsByCategory.accessibility
    },
    seo: {
      score: seoScore,
      improvements: improvementsByCategory.seo
    },
    bestPractices: {
      score: bestPracticesScore,
      issues: improvementsByCategory.bestPractices
    },
    links: {
      internal: links.internal.count,
      external: links.external.count,
      recommendedInternal: links.internal.recommendation === 'good' ? links.internal.count : (links.internal.recommendation === 'low' ? 50 : 20),
      recommendedExternal: links.external.recommendation === 'good' ? links.external.count : (links.external.recommendation === 'low' ? 10 : 20)
    },
    images: {
      total: images.total,
      withoutAltText: images.withoutAltText,
      locations: images.missingAltDetails,
    },
    url_improvements: {
      original: url,
      improved: url
    },
    meta: {
      original: {
        title: technical.metaTags.title || '',
        description: technical.metaTags.description || ''
      },
      improved: improvedMeta
    },
    html
  };
}