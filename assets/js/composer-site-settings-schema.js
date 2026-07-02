const defaultTranslate = (key) => key;

export function createComposerSiteSettingsSchema(options = {}) {
  const t = typeof options.t === 'function' ? options.t : defaultTranslate;

  const section = (key) => ({
    key,
    title: t(`editor.composer.site.sections.${key}.title`),
    description: t(`editor.composer.site.sections.${key}.description`)
  });

  const field = (dataKey, labelKey, descriptionKey, extra = {}) => ({
    dataKey,
    label: t(`editor.composer.site.fields.${labelKey}`),
    description: t(`editor.composer.site.fields.${descriptionKey}`),
    ...extra
  });

  return {
    sections: {
      repo: section('repo'),
      identity: section('identity'),
      seo: section('seo'),
      configuration: section('configuration'),
      extras: section('extras')
    },
    subsections: {
      behavior: section('behavior'),
      publicChrome: section('publicChrome'),
      theme: section('theme'),
      comments: section('comments'),
      assets: section('assets')
    },
    fields: {
      identityPaths: [
        field('avatar', 'avatar', 'avatarHelp', { placeholder: 'assets/avatar.png' }),
        field('contentRoot', 'contentRoot', 'contentRootHelp', { placeholder: 'wwwroot' })
      ],
      seoResources: [
        field('resourceURL', 'resourceURL', 'resourceURLHelp', { placeholder: 'https://example.com/' })
      ],
      behavior: {
        defaultLanguage: field('defaultLanguage', 'defaultLanguage', 'defaultLanguageHelp'),
        contentOutdatedDays: field('contentOutdatedDays', 'contentOutdatedDays', 'contentOutdatedDaysHelp', { min: 0 }),
        pageSize: field('pageSize', 'pageSize', 'pageSizeHelp', { min: 1 }),
        landingTab: field('landingTab', 'landingTab', 'landingTabHelp'),
        cardCoverFallback: field('cardCoverFallback', 'cardCoverFallback', 'cardCoverFallbackHelp', {
          checkboxLabel: t('editor.composer.site.toggleEnabled')
        }),
        errorOverlay: field('errorOverlay', 'errorOverlay', 'errorOverlayHelp', {
          checkboxLabel: t('editor.composer.site.toggleEnabled')
        })
      },
      publicChrome: {
        search: field('searchFeature', 'featureSearch', 'featureSearchHelp', {
          checkboxLabel: t('editor.composer.site.toggleEnabled')
        }),
        editorEntry: field('editorEntryFeature', 'featureEditorEntry', 'featureEditorEntryHelp', {
          checkboxLabel: t('editor.composer.site.toggleEnabled')
        }),
        visitorThemeControls: field('visitorThemeControlsFeature', 'featureVisitorThemeControls', 'featureVisitorThemeControlsHelp', {
          checkboxLabel: t('editor.composer.site.toggleEnabled')
        }),
        languageSwitcher: field('languageSwitcherFeature', 'featureLanguageSwitcher', 'featureLanguageSwitcherHelp', {
          checkboxLabel: t('editor.composer.site.toggleEnabled')
        }),
        allPosts: field('allPostsFeature', 'featureAllPosts', 'featureAllPostsHelp', {
          checkboxLabel: t('editor.composer.site.toggleEnabled')
        }),
        footerNav: field('footerNavFeature', 'featureFooterNav', 'featureFooterNavHelp', {
          checkboxLabel: t('editor.composer.site.toggleEnabled')
        }),
        profileLinks: field('profileLinksFeature', 'featureProfileLinks', 'featureProfileLinksHelp', {
          checkboxLabel: t('editor.composer.site.toggleEnabled')
        }),
        tags: field('tagsFeature', 'featureTags', 'featureTagsHelp', {
          checkboxLabel: t('editor.composer.site.toggleEnabled')
        }),
        toc: field('tocFeature', 'featureToc', 'featureTocHelp', {
          checkboxLabel: t('editor.composer.site.toggleEnabled')
        }),
        postMeta: field('postMetaFeature', 'featurePostMeta', 'featurePostMetaHelp', {
          checkboxLabel: t('editor.composer.site.toggleEnabled')
        }),
        comments: field('commentsFeature', 'featureComments', 'featureCommentsHelp', {
          checkboxLabel: t('editor.composer.site.toggleEnabled')
        })
      }
    }
  };
}
