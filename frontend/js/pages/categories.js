/* Page-specific JavaScript: frontend/js/pages/categories.js
 * Add custom buttons, event handlers and behavior for the categories page here.
 * Shared API, session/authentication and site-wide UI helpers live in frontend/js/modules/.
 * This hook runs after each client-side render. Use the supplied root to scope DOM changes.
 */
(function(global){
 const registry=global.MCQCampusPageHooks||(global.MCQCampusPageHooks=Object.create(null));
 const hooks=registry["categories"]||(registry["categories"]={});
 hooks.afterRender=function(root,context={}){
  if(!root)return;
  root.dataset.pageScript="categories";
  root.dispatchEvent(new CustomEvent("mcqcampus:page-ready",{
   bubbles:true,
   detail:{page:"categories",path:context.path||global.location.pathname,base:context.base||"categories",root}
  }));
 };
})(window);
