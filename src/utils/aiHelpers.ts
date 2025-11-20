import { generateObject } from 'ai';
import { bedrock } from '@ai-sdk/amazon-bedrock';
import { z } from 'zod';

const improvementSchema = z.object({
  headline: z.string().describe("Concise, actionable headline (max 10 words)"),
  description: z.string().describe("Simple, easy-to-understand explanation"),
  priority: z.enum(['high', 'medium', 'low']).describe("Priority level based on impact")
});

const improvementsSchema = z.object({
  improvements: z.array(improvementSchema)
});

export async function extractAuditImprovementsWithAI(
  desktopAudits: any,
  mobileAudits: any,
  scores: any
) {
  const processCategory = async (audits: any, categoryName: string, score: string) => {
    const failingAudits: Array<{ title: string; description: string; displayValue?: string }> = [];

    Object.entries(audits).forEach(([auditId, audit]: any) => {
      if (audit.score < 1 && audit.score !== null && audit.title && audit.description) {
        failingAudits.push({
          title: audit.title,
          description: audit.description,
          displayValue: audit.displayValue
        });
      }
    });

    if (failingAudits.length === 0) {
      return [];
    }

    const auditSummary = failingAudits
      .slice(0, 10)
      .map(a => `${a.title}: ${a.description}${a.displayValue ? ` (${a.displayValue})` : ''}`)
      .join('\n');

    try {
      const result = await generateObject({
        model: bedrock('global.anthropic.claude-haiku-4-5-20251001-v1:0'),
        schema: improvementsSchema,
        prompt: `You are an SEO and performance optimization expert. Analyze the Lighthouse audit findings and return only the most relevant, simple, and actionable improvements for the specified category.  

Category: ${categoryName}  
Lighthouse Findings: ${auditSummary}  
Lighthouse Score: ${score}  

Instructions:  
- If the SEO score is 100, respond with “No improvements needed.”  
- Provide only 3–5 of the most impactful improvements related **only** to the given category.  
- Each improvement must include:  
  1. A short, clear headline (max 10 words).  
  2. A one-line, plain-language action step for non-technical users.  
- Discard or ignore all findings unrelated to the chosen category.  
- Keep the response concise and directly tied to ${categoryName} and ${score}.   
        `   
      });

      return result.object.improvements.map(imp => `${imp.headline} - ${imp.description}`);
    } catch (error) {
      console.error(`Error processing ${categoryName} with AI:`, error);
      return failingAudits.slice(0, 5).map(a => `${a.title}: ${a.description}`);
    }
  };

  const [performance, accessibility, seo, bestPractices] = await Promise.all([
    processCategory(desktopAudits, 'Performance', scores.performanceScore),
    processCategory(desktopAudits, 'Accessibility', scores.accessibilityScore),
    processCategory(desktopAudits, 'SEO', scores.seoScore),
    processCategory(desktopAudits, 'Best Practices', scores.bestPracticesScore)
  ]);
  
  return { performance, accessibility, seo, bestPractices };
}

export async function generateOptimizedMeta(
  originalTitle: string | undefined,
  originalDescription: string | undefined,
  url: string
) {
  if (!originalTitle && !originalDescription) {
    return {
      title: 'Optimized Page Title',
      description: 'Optimized page description'
    };
  }

  try {
    const result = await generateObject({
      model: bedrock('global.anthropic.claude-haiku-4-5-20251001-v1:0'),
      schema: z.object({
        title: z.string().max(60).describe("SEO-optimized meta title (max 60 chars)"),
        description: z.string().max(160).describe("SEO-optimized meta description (max 160 chars)")
      }),
      prompt: `Generate an SEO-optimized meta title and description for a webpage.

Current Title: ${originalTitle || 'Not provided'}
Current Description: ${originalDescription || 'Not provided'}
URL: ${url}

Create an improved version that:
- Title: Clear, keyword-rich, max 60 characters
- Description: Compelling, includes call-to-action, max 160 characters
- Both should be improvements over the originals while being realistic and professional`
    });
    
    return {
      title: result.object.title,
      description: result.object.description
    };
  } catch (error) {
    console.error('Error generating optimized meta with AI:', error);
    return {
      title: originalTitle ? `${originalTitle.substring(0, 55)}...` : 'Optimized Title',
      description: originalDescription ? `${originalDescription.substring(0, 155)}...` : 'Optimized description'
    };
  }
}