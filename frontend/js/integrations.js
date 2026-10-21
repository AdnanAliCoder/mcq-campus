/* Optional provider integrations are configured through the Django API, not injected into HTML. */
(function (global) {
  let analyticsStarted = '';
  let adsenseStarted = '';

  global.MCQCampusApplyOptionalIntegrations = function (settings = {}) {
    const analyticsId = settings.analyticsEnabled ? String(settings.googleAnalyticsId || '').trim() : '';
    if (analyticsId && !analyticsStarted) {
      analyticsStarted = analyticsId;
      global.dataLayer = global.dataLayer || [];
      global.gtag = function () { global.dataLayer.push(arguments); };
      global.gtag('js', new Date());
      global.gtag('config', analyticsId);
      const analytics = document.createElement('script');
      analytics.async = true;
      analytics.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(analyticsId);
      document.head.appendChild(analytics);
    }

    const adsenseId = settings.adsenseEnabled ? String(settings.adsenseClientId || '').trim() : '';
    if (adsenseId && !adsenseStarted) {
      adsenseStarted = adsenseId;
      const adsense = document.createElement('script');
      adsense.async = true;
      adsense.crossOrigin = 'anonymous';
      adsense.src = 'https://pagead2.googlesyndication.com/pagead/js?client=' + encodeURIComponent(adsenseId);
      document.head.appendChild(adsense);
    }
  };
})(window);

;
