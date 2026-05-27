// Compatibility facade for DOM-free block editor model helpers.

export {
  appendInlineRun,
  applyInlineLinkToRuns,
  applyInlineMathToRuns,
  inlineMarksAtOffset,
  inlineRangeAnyMarked,
  inlineRangeFullyMarked,
  inlineRangeText,
  inlineRenderedTextLength,
  inlineRun,
  inlineRunsTextLength,
  insertInlineRunsAtRange,
  linkTitleForRun,
  mergeInlineRuns,
  normalizeEditableMarkdownText,
  parseInlineRuns,
  rangeHasInlineText,
  removeInlineMarkAroundOffset,
  removeInlineMarkInRange,
  sanitizeEditorLinkHref,
  sanitizeEditorLinkTitle,
  serializeInlineRuns,
  toggleInlineMarkOnRuns
} from './editor-blocks-inline-model.js';

export {
  convertListTailItemAfterEmptyToParagraph,
  dedentIndentedListSource,
  defaultListItems,
  editableListItems,
  effectiveListItemType,
  indentationColumn,
  isListItemLine,
  isMergeableListBlock,
  itemIndentLevel,
  listBlockItems,
  listItemHasNestedChildren,
  listItemText,
  listVisualMarkerLabels,
  mergeListItemIntoPreviousItem,
  normalizeListItemType,
  normalizeSplitListStartItems,
  normalizeStandardListType,
  outdentEmptyListItemForEnter,
  parseListBlock,
  parseListLineInfo,
  patchListItem,
  patchListItemType,
  patchStandardListItemType,
  serializeList,
  splitListItemsAtEmptyItem,
  summarizeListType
} from './editor-blocks-list-model.js';

export {
  editableTableData,
  normalizeTableAlignment,
  normalizeTableCellValue,
  parseTableBlock,
  serializeTable,
  tableColumnCount
} from './editor-blocks-table-model.js';

export {
  isBlockEmptyForBackspace,
  isMergeableTextBlock,
  joinMergedEditableText,
  mergeFirstListItemIntoPreviousBlock,
  mergeTextBlockIntoPrevious,
  mergeTextBlockIntoPreviousList,
  splitTextBlockIntoParagraph
} from './editor-blocks-block-flow-model.js';

export {
  BLOCK_TYPES,
  escapeHtml,
  makeBlankBlock,
  makeBlock,
  normalizeText,
  splitBlankLineUnits
} from './editor-blocks-block-core-model.js';

export {
  autofixMarkdownSourceBlock,
  parseMarkdownBlocks
} from './editor-blocks-markdown-parse-model.js';

export {
  serializeMarkdownBlocks
} from './editor-blocks-markdown-serialize-model.js';
