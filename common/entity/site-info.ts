export const SITE_DECLARATIONS = [
  { id: 'account-management-rules', titleKey: 'accountManagementRules' },
  { id: 'online-service-agreement', titleKey: 'onlineServiceAgreement' },
  { id: 'platform-management-rules', titleKey: 'platformManagementRules' },
  { id: 'third-party-sharing-list', titleKey: 'thirdPartySharingList' },
  { id: 'personal-information-collection-list', titleKey: 'personalInformationCollectionList' },
  { id: 'software-license-user-agreement', titleKey: 'softwareLicenseUserAgreement' },
] as const

export type SiteDeclarationId = (typeof SITE_DECLARATIONS)[number]['id']

export interface SiteDeclaration {
  id: SiteDeclarationId
  content: string
  updatedAt?: string
}

export interface SiteSuggestion {
  id: string
  userTag: string
  content: string
  createdAt: string
  isRead: boolean
}

export function isSiteDeclarationId(value: string): value is SiteDeclarationId {
  return SITE_DECLARATIONS.some((item) => item.id === value)
}
