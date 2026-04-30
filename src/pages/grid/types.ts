export const API_URLS = {
  tabs: 'https://functions.poehali.dev/86104f38-169c-4ce4-b077-38f1883a61c5',
  cells: 'https://functions.poehali.dev/f2f9a3f0-13c8-4862-8b02-aea4ab6b62d4'
};

export const GRID_CONFIG = {
  rows: 25,
  cols: 15,
  desktopWidth: 552
};

export interface Cell {
  id?: number;
  tab_id: number;
  row_index: number;
  col_index: number;
  content: string;
  header?: string;
}

export interface Tab {
  id: number;
  name: string;
  position: number;
}
