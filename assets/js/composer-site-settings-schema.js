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
        showAllPosts: field('showAllPosts', 'showAllPosts', 'showAllPostsHelp', {
          checkboxLabel: t('editor.composer.site.toggleEnabled')
        }),
        landingTab: field('landingTab', 'landingTab', 'landingTabHelp'),
        cardCoverFallback: field('cardCoverFallback', 'cardCoverFallback', 'cardCoverFallbackHelp', {
          checkboxLabel: t('editor.composer.site.toggleEnabled')
        }),
        errorOverlay: field('errorOverlay', 'errorOverlay', 'errorOverlayHelp', {
          checkboxLabel: t('editor.composer.site.toggleEnabled')
        })
      }
    }
  };
}
