import { LOCALE_QUERY_PARAM, LOCALE_STORAGE_KEY } from "@/lib/i18n/locale";

/**
 * Runs before the first paint (inline, no network): applies the visitor's language to
 * <html lang> and, when it is not Spanish, hides the storefront until React has rendered
 * it in that language. A CSS fallback reveals the page after 1.5 s even if scripts fail,
 * so nobody ever gets a blank screen. Same priority rules as useLocale().
 */
const SCRIPT = `(function(){try{
var d=document.documentElement;
var pick=function(v){if(!v)return null;v=String(v).toLowerCase().split(/[-_]/)[0];return v==="es"||v==="en"?v:null;};
var l=pick(new URLSearchParams(location.search).get(${JSON.stringify(LOCALE_QUERY_PARAM)}));
if(!l){try{l=pick(localStorage.getItem(${JSON.stringify(LOCALE_STORAGE_KEY)}));}catch(e){}}
if(!l){var n=navigator.languages&&navigator.languages.length?navigator.languages:[navigator.language];for(var i=0;i<n.length&&!l;i++){l=pick(n[i]);}}
l=l||"es";d.lang=l;if(l!=="es"){d.setAttribute("data-sh-locale-pending",l);}
}catch(e){}})();`;

const STYLE = `html[data-sh-locale-pending] [data-sh-i18n]{visibility:hidden;animation:sh-i18n-reveal 0s linear 1.5s forwards}@keyframes sh-i18n-reveal{to{visibility:visible}}`;

export function LocaleBootScript() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: STYLE }} />
      <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />
    </>
  );
}
