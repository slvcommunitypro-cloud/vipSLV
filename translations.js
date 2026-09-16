(function (root) {
  const dict = {
    ru: null,
    en: null
  };

  async function loadLocale(code) {
    const file = code === "en" ? "en.json" : "ru.json";
    const res = await fetch(file, { cache: "no-store" });
    if (!res.ok) throw new Error("locale " + file);
    dict[code] = await res.json();
    return dict[code];
  }

  function t(path, locale) {
    const pack = dict[locale] || dict.ru || {};
    return path.split(".").reduce((acc, key) => (acc && acc[key] != null ? acc[key] : path), pack);
  }

  root.PODeskI18n = { loadLocale, t, dict };
})(window);
