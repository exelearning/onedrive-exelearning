/**
 * Inline SVG icons used by the toolbars. Kept as raw strings so they can be
 * spliced into `innerHTML` without a separate network request and themed via
 * `currentColor`.
 */

/**
 * Microsoft OneDrive cloud icon, simplified two-tone version of the official
 * brand mark. Used by the editor toolbar to label the "Save to OneDrive"
 * action. Inline rather than fetched so the toolbar paints with the rest of
 * the shell.
 */
export const ONEDRIVE_ICON_SVG = `
<svg class="onedrive-icon" viewBox="0 0 32 21" aria-hidden="true" focusable="false">
  <path fill="#0364B8" d="M19.453 11.235l5.875-5.621A10.122 10.122 0 0 0 16.69 0a10.13 10.13 0 0 0-9.39 6.347 5.628 5.628 0 0 1 1.005-.09c.275 0 .544.02.81.057a8.486 8.486 0 0 1 10.337 4.92z"/>
  <path fill="#0078D4" d="M9.31 6.32a5.668 5.668 0 0 0-4.948 8.43l4.79-2.012a3.43 3.43 0 0 1 4.51-1.59l4.04-3.864A8.486 8.486 0 0 0 9.31 6.32z"/>
  <path fill="#1490DF" d="M14.5 11.14a3.4 3.4 0 0 0-1.34.276l-8.798 3.696a5.626 5.626 0 0 0 4.7 2.519h14.452a4.998 4.998 0 0 0 4.366-7.418l-9.97-4.187a3.4 3.4 0 0 0-3.41 5.114z"/>
  <path fill="#28A8EA" d="M14.5 11.14l13.38 5.621A4.998 4.998 0 0 0 23.514 9.6l-5.872 5.617a3.43 3.43 0 0 1-3.143-4.077z"/>
</svg>`;

/**
 * Mirrors `public/icons/exelearning.svg` (the eXeLearning brand mark — a
 * teal "X" glyph) so the toolbar can render it without a separate request.
 */
export const EXELEARNING_ICON_SVG = `
<svg class="exelearning-icon" viewBox="0 -0.519 60.17152 60.17152" aria-hidden="true" focusable="false">
  <g transform="translate(-109.80208,-121.17917)">
    <path d="m 120.63912,121.17916 c 2.50296,0 5.17684,0.9102 8.02111,2.7306 2.78765,1.7635 6.62755,4.89233 11.5197,9.38644 8.4193,-7.05406 12.91034,-8.64301 17.23363,-8.64301 2.78765,0 5.17684,0.76798 7.16783,2.30394 3.66792,2.80477 4.27963,9.21022 1.71,13.42157 -2.04787,3.35637 -4.72175,6.96873 -8.02111,10.83701 7.50914,8.53308 11.70332,14.673 11.70332,18.88279 0,3.01492 -0.93874,5.31892 -2.81596,6.91171 -1.93411,1.59279 -4.35187,2.38919 -7.25303,2.38919 -4.38044,0 -11.24849,-3.3237 -19.72468,-10.43464 -4.83526,4.2664 -8.64685,7.22471 -11.43424,8.87439 -2.84453,1.64967 -5.54672,2.47465 -8.10657,2.47465 -3.41323,0 -6.0585,-1.1094 -7.93578,-3.32793 -1.93418,-2.27568 -2.90126,-4.9493 -2.90126,-8.02111 0,-1.99126 0.28443,-3.72613 0.85331,-5.20541 0.56888,-1.47903 1.62129,-3.1287 3.15725,-4.94904 1.53596,-1.87748 3.98213,-4.46563 7.33845,-7.76525 -3.24254,-3.29936 -5.63181,-5.94471 -7.1678,-7.93576 -1.59284,-2.04795 -2.67369,-3.83992 -3.24257,-5.37588 -0.62577,-1.53596 -0.93864,-3.24257 -0.93864,-5.11987 0,-1.99107 0.42664,-3.8399 1.27995,-5.54651 0.85334,-1.76353 2.10484,-3.18572 3.7546,-4.26658 1.64973,-1.08087 3.58391,-1.6213 5.80249,-1.6213 z" fill="#26ddc7"/>
  </g>
</svg>`;

/**
 * Material-style chevron-left used by the "Back" affordance.
 */
export const BACK_ICON_SVG = `
<svg class="back-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
  <path d="M15 6l-6 6 6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

/**
 * Microsoft logo glyph (the four-tile windows). Used on the authorize button
 * so the user immediately recognises the sign-in provider.
 */
export const MICROSOFT_LOGO_SVG = `
<svg class="microsoft-icon" viewBox="0 0 21 21" aria-hidden="true" focusable="false">
  <rect x="1" y="1" width="9" height="9" fill="#F25022"/>
  <rect x="11" y="1" width="9" height="9" fill="#7FBA00"/>
  <rect x="1" y="11" width="9" height="9" fill="#00A4EF"/>
  <rect x="11" y="11" width="9" height="9" fill="#FFB900"/>
</svg>`;
