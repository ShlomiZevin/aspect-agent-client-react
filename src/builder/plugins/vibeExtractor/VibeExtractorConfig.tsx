/**
 * Vibe Extractor — config screen.
 *
 * Mechanically identical to the Field Extractor config: same model
 * picker, same extractsFields list, same field editor. We re-use
 * Field Extractor's component verbatim rather than duplicating the
 * UI — the two addons share the same config SHAPE, so they should
 * share the same form. Distinction lives in the descriptor's
 * defaults / purpose / icon and in the picker.
 *
 * If we ever want Vibe-specific copy in the form (e.g. "Vibes to
 * read" instead of "Fields to extract"), split this file then.
 */

export { FieldExtractorConfigComponent as VibeExtractorConfigComponent } from '../fieldExtractor/FieldExtractorConfig';
