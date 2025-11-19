import { generateObject } from 'ai';
import { bedrock } from '@ai-sdk/amazon-bedrock';
import { z } from 'zod';

const robotsValidationSchema = z.object({
  allowed: z.boolean().describe("Whether the URL is allowed by robots.txt")
});

export async function fetchRobotsTxt(baseUrl: string): Promise<string | null> {
  try {
    const response = await fetch(`${baseUrl}/robots.txt`);
    if (response.ok) {
      return await response.text();
    }
  } catch (e) {
    console.error('Error fetching robots.txt:', e);
  }
  return null;
}

export async function discoverSitemap(baseUrl: string): Promise<string | null> {
  try {
    const sitemapUrls = [
      `${baseUrl}/sitemap.xml`,
      `${baseUrl}/sitemap.txt`,
      `${baseUrl}/sitemap-index.xml`
    ];

    for (const sitemapUrl of sitemapUrls) {
      const response = await fetch(sitemapUrl);
      if (response.ok) {
        return sitemapUrl;
      }
    }
  } catch (e) {
    console.error('Error discovering sitemap:', e);
  }
  return null;
}

export async function fetchSitemapContent(sitemapUrl: string): Promise<string | null> {
  try {
    const response = await fetch(sitemapUrl);
    if (response.ok) {
      return await response.text();
    }
  } catch (e) {
    console.error('Error fetching sitemap:', e);
  }
  return null;
}

export async function validateUrlAgainstRobots(url: string, robotsTxtContent: string | null): Promise<boolean> {
  if (!robotsTxtContent) {
    return true;
  }

  try {
    const result = await generateObject({
      model: bedrock('global.anthropic.claude-haiku-4-5-20251001-v1:0'),
      schema: robotsValidationSchema,
      prompt: `Analyze this robots.txt file and determine if the URL "${url}" is allowed to be crawled.

robots.txt content:
${robotsTxtContent}

Return true if the URL is allowed, false if it's disallowed. Consider all user-agent rules, disallow/allow directives, and wildcards.`
    });
    return result.object.allowed;
  } catch (error) {
    console.error('Error validating URL with LLM:', error);
    return true;
  }
}

export async function validateCanonicalTag(html: string | any): Promise<boolean> {
  try {
    const htmlContent = typeof html === 'string' ? html : html.html || '';
    const markdown = typeof html === 'object' ? html.markdown || '' : '';
    
    // Use LLM to analyze if canonical tag exists
    const result = await generateObject({
      model: bedrock('global.anthropic.claude-haiku-4-5-20251001-v1:0'),
      schema: z.object({
        canonicalExists: z.boolean().describe("Whether a canonical tag exists in the page")
      }),
      prompt: `Analyze this HTML and markdown content to determine if a canonical tag exists on the page.

HTML Content:
${htmlContent.substring(0, 2000)}

Markdown Content:
${markdown.substring(0, 2000)}

Check for:
1. <link rel="canonical" href="..."> in the HTML head
2. Any canonical URL references

Return true if a canonical tag is present, false otherwise.`
    });
    
    return result.object.canonicalExists;
  } catch (error) {
    console.error('Error validating canonical tag:', error);
    // Fallback to regex check
    const htmlContent = typeof html === 'string' ? html : html.html || '';
    const canonicalMatch = htmlContent.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i);
    return !!canonicalMatch;
  }
}