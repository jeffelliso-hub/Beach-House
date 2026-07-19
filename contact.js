// Injects contact details at runtime so harvester bots (which don't run JS)
// can't scrape the email or phone from the page source. Real browsers get
// fully working mailto:/tel: links and visible numbers.
(function () {
  function d(s) { try { return atob(s); } catch (e) { return ''; } }
  var email = d('c2hlbGJ5ZWVsbGlzb25AZ21haWwuY29t');       // email address
  var telNum = d('NzA0NjE2NzUyNw==');                       // phone digits for tel:
  var telTxt = d('NzA0LTYxNi03NTI3');                       // phone display text

  document.querySelectorAll('[data-eml]').forEach(function (el) {
    if (el.tagName === 'A') el.setAttribute('href', 'mailto:' + email);
    if (el.hasAttribute('data-eml-text')) el.textContent = email;
  });
  document.querySelectorAll('[data-tel]').forEach(function (el) {
    if (el.tagName === 'A') el.setAttribute('href', 'tel:' + telNum);
    if (el.hasAttribute('data-tel-text')) el.textContent = telTxt;
  });
  document.querySelectorAll('[data-tel-text]:not([data-tel])').forEach(function (el) {
    el.textContent = telTxt;
  });
})();
