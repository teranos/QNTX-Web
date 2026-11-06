// Stylelint for QNTX's css. The shell is held to tokens; an element's interior
// (css-interiors.json) is allowed to be its own thing: it keeps the correctness
// rules and the QNTX-wide axioms, and drops the look rules.
import { readFileSync } from 'node:fs';

const { interiors } = JSON.parse(readFileSync(new URL('./css-interiors.json', import.meta.url), 'utf8'));

export default {
    plugins: ['stylelint-declaration-strict-value'],
    rules: {
        "scale-unlimited/declaration-strict-value": [
            [
                "/color$/",
                "background",
                "background-color",
                "fill",
                "stroke",
                "/radius$/",
                "z-index",
                "box-shadow",
                "outline-color"
            ],
            {
                "ignoreValues": [
                    "inherit",
                    "initial",
                    "unset",
                    "none",
                    "transparent",
                    "currentColor",
                    "currentcolor",
                    "auto",
                    "0",
                    "50%",
                    "100%"
                ],
                "disableFix": true,
                "message": "Use a token: var(--...) from tokens.css (found \"${value}\" for ${property})",
                "ignoreFunctions": false
            }
        ],
        "declaration-property-value-disallowed-list": {
            "text-overflow": [
                "/ellipsis/"
            ],
            "/^(border|outline|text-shadow|background-image|filter|caret-color|column-rule)/": [
                "/#[0-9a-f]{3,8}\\b/i",
                "/\\b(rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch)\\(/i"
            ]
        },
        "declaration-property-value-no-unknown": true,
        "property-no-unknown": true,
        "no-descending-specificity": true,
        "selector-max-id": 0,
        "declaration-no-important": true
    },
    overrides: [
        { files: ['css/tokens.css'], rules: { 'scale-unlimited/declaration-strict-value': null } },
        {
            files: interiors,
            rules: {
                'scale-unlimited/declaration-strict-value': null,
                'declaration-property-value-disallowed-list': { 'text-overflow': ['/ellipsis/'] },
            },
        },
    ],
};
