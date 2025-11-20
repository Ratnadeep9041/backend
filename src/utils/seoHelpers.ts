import { generateObject } from 'ai';
import { bedrock } from '@ai-sdk/amazon-bedrock';
import { z } from 'zod';
import * as cheerio from 'cheerio';

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

export async function checkCanonical(url: string): Promise<{
  exists: boolean;
  canonicalUrl?: string;
  selfReferencing?: boolean;
}> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SEO-Audit-Bot/1.0)',
      },
    });

    const html = await response.text();
    const $ = cheerio.load(html);
    
    // Extract canonical URL
    const canonicalUrl = $('link[rel="canonical"]').attr('href');
    
    if (!canonicalUrl) {
      return { exists: false };
    }

    // Normalize URLs for comparison
    const normalizeUrl = (u: string) => 
      u.trim().toLowerCase()
        .replace(/^https?:\/\//, '')
        .replace(/^www\./, '')
        .replace(/\/$/, '');

    const isSelfReferencing = normalizeUrl(canonicalUrl) === normalizeUrl(url);

    return {
      exists: true,
      canonicalUrl,
      selfReferencing: isSelfReferencing,
    };
  } catch (error) {
    console.error('Error checking canonical:', error);
    return { exists: false };
  }
}