import Firecrawl from "@mendable/firecrawl-js";
import psi from 'psi';
import { AuditResponse } from "./types";
import { fetchRobotsTxt, validateUrlAgainstRobots, checkCanonical } from "./utils/seoHelpers"
import { extractTechnicalSeo, extractLinks, extractImages, validateAndImproveSchema } from "./utils/contentExtractors"
import { extractAuditImprovementsWithAI, generateOptimizedMeta } from "./utils/aiHelpers"

const firecrawl = new Firecrawl({
  apiKey: process.env.FIRECRAWL_API_KEY || "",
});

async function checkUrlInSitemap(baseUrl: string, targetUrl: string): Promise<boolean> {

  try {
    const mapResult = await firecrawl.map(baseUrl, {
      sitemap: 'only',
      limit: 1000,
    });

    if (!mapResult.links) {
      console.error('Failed to retrieve sitemap');
      return false;
    }


    return mapResult.links.some((result) => {
      const url = result.url
      return url.trim().includes(targetUrl.trim());
    });

  } catch (error) {
    console.error('Error checking URL in sitemap:', error);
    return false;
  }
}




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

  const sitemapPresent = await checkUrlInSitemap(baseUrl, url)
  console.log({sitemapPresent})
  // Validate URL against robots.txt
  const robotsTextPresent = await validateUrlAgainstRobots(url, robotsTxtContent);

  // Scrape page with Firecrawl
  const scrapeResult = await firecrawl.scrape(url, {
    formats: ["markdown", "html"],
  });

  // Parse HTML for technical SEO
  const html = scrapeResult.html || '';
  const metaData = scrapeResult?.metadata as Record<string, string>;
  const technical = await extractTechnicalSeo(html, metaData, url);

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
      sitemapPresent: !!sitemapPresent,
      robotsTextPresent: !!robotsTxtContent,
      canonicalTag: technical.canonicalTag,
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