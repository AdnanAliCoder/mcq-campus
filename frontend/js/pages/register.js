/* Page-specific JavaScript: frontend/js/pages/register.js
 * Add custom buttons, event handlers and behavior for the register page here.
 * Shared API, session/authentication and site-wide UI helpers live in frontend/js/modules/.
 * This hook runs after each client-side render. Use the supplied root to scope DOM changes.
 */
(function(global){
 const registry=global.MCQCampusPageHooks||(global.MCQCampusPageHooks=Object.create(null));
 const hooks=registry["register"]||(registry["register"]={});
 hooks.afterRender=function(root,context={}){
  if(!root)return;
  root.dataset.pageScript="register";
  root.dispatchEvent(new CustomEvent("mcqcampus:page-ready",{
   bubbles:true,
   detail:{page:"register",path:context.path||global.location.pathname,base:context.base||"register",root}
  }));
 };
})(window);
