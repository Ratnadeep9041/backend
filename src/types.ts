export interface AuditRequest {
    url: string;
  }

  export interface AuditResponse {
    url: string
    timestamp: string
    technical: {
      sitemapPresent: boolean
      robotsTextPresent: boolean
      canonicalTagPresent: boolean
      schemaMarkup: string[]
      schemaValidation: {
        valid: boolean
        errors: number
        warnings: number
        currentSchema: string[]
        improvements: string[]
      } | null
      statusCodes: {
        code4xx: number
        code3xx: number
      }
    }
    performance: {
      score: number
      improvements: string[]
    }
    accessibility: {
      score: number
      issues: string[]
    }
    seo: {
      score: number
      improvements: string[]
    }
    bestPractices: {
      score: number
      issues: string[]
    }
    links: {
      internal: number
      external: number
      recommendedInternal: number
      recommendedExternal: number
    }
    images: {
      total: number
      withoutAltText: number
      locations: { src: string, alt?: string }[]
    }
    url_improvements: {
      original: string
      improved: string
    }
    meta: {
      original: {
        title: string
        description: string
      }
      improved: {
        title: string
        description: string
      }
    }
    html: string
}