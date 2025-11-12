import { useState, useEffect, useCallback } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import Icon from '@/components/ui/icon';

interface Cell {
  id?: number;
  tab_id: number;
  row_index: number;
  col_index: number;
  content: string;
}

interface Tab {
  id: number;
  name: string;
  position: number;
}

interface Image {
  id: number;
  file_name: string;
  file_url: string;
  created_at: string;
}

const ROWS = 20;
const COLS = 15;

const Index = () => {
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTab, setActiveTab] = useState<number>(1);
  const [cells, setCells] = useState<Record<string, Cell>>({});
  const [editingCell, setEditingCell] = useState<{ row: number; col: number } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [images, setImages] = useState<Image[]>([]);
  const [uploading, setUploading] = useState(false);

  const getCellKey = (tabId: number, row: number, col: number) => `${tabId}-${row}-${col}`;

  useEffect(() => {
    loadTabs();
  }, []);

  useEffect(() => {
    if (activeTab && tabs.length > 0) {
      const currentTab = tabs.find(t => t.id === activeTab);
      if (currentTab?.name === 'Картинки') {
        loadImages();
      } else {
        loadCells(activeTab);
      }
    }
  }, [activeTab]);

  const loadTabs = async () => {
    try {
      const response = await fetch('https://functions.poehali.dev/86104f38-169c-4ce4-b077-38f1883a61c5');
      const data = await response.json();
      setTabs(data.tabs || []);
      if (data.tabs && data.tabs.length > 0) {
        setActiveTab(data.tabs[0].id);
      }
    } catch (error) {
      toast.error('Ошибка загрузки вкладок');
    }
  };

  const loadCells = async (tabId: number) => {
    try {
      setLoading(true);
      const response = await fetch(`https://functions.poehali.dev/f2f9a3f0-13c8-4862-8b02-aea4ab6b62d4?tab_id=${tabId}`);
      const data = await response.json();
      const cellsMap: Record<string, Cell> = {};
      (data.cells || []).forEach((cell: Cell) => {
        const key = getCellKey(tabId, cell.row_index, cell.col_index);
        cellsMap[key] = cell;
      });
      setCells(cellsMap);
    } catch (error) {
      toast.error('Ошибка загрузки данных');
    } finally {
      setLoading(false);
    }
  };

  const handleCellClick = useCallback((row: number, col: number) => {
    const key = getCellKey(activeTab, row, col);
    const cell = cells[key];
    const content = cell?.content || '';
    
    if (content) {
      navigator.clipboard.writeText(content);
      toast.success('Скопировано!');
    }
  }, [activeTab, cells]);

  const handleCellDoubleClick = useCallback((row: number, col: number) => {
    const key = getCellKey(activeTab, row, col);
    const cell = cells[key];
    setEditValue(cell?.content || '');
    setEditingCell({ row, col });
  }, [activeTab, cells]);

  const handleSaveCell = async () => {
    if (!editingCell) return;

    try {
      const response = await fetch('https://functions.poehali.dev/f2f9a3f0-13c8-4862-8b02-aea4ab6b62d4', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tab_id: activeTab,
          row_index: editingCell.row,
          col_index: editingCell.col,
          content: editValue,
        }),
      });

      if (response.ok) {
        const key = getCellKey(activeTab, editingCell.row, editingCell.col);
        setCells(prev => ({
          ...prev,
          [key]: {
            tab_id: activeTab,
            row_index: editingCell.row,
            col_index: editingCell.col,
            content: editValue,
          }
        }));
        toast.success('Сохранено!');
      }
    } catch (error) {
      toast.error('Ошибка сохранения');
    } finally {
      setEditingCell(null);
      setEditValue('');
    }
  };

  const handleAddColumn = () => {
    toast.info('Прокрутите вправо для новых столбцов');
  };

  const handleAddRow = () => {
    toast.info('Прокрутите вниз для новых строк');
  };

  const loadImages = async () => {
    try {
      setLoading(true);
      const response = await fetch('https://functions.poehali.dev/98030051-bc07-464d-98f9-7504adfd39e1');
      const data = await response.json();
      setImages(data.images || []);
    } catch (error) {
      toast.error('Ошибка загрузки изображений');
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    
    for (const file of Array.from(files)) {
      try {
        const reader = new FileReader();
        reader.onload = async (event) => {
          const base64Data = event.target?.result as string;
          
          const response = await fetch('https://functions.poehali.dev/98030051-bc07-464d-98f9-7504adfd39e1', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              file_name: file.name,
              file_data: base64Data
            })
          });

          if (response.ok) {
            await loadImages();
            toast.success('Изображение загружено!');
          }
        };
        reader.readAsDataURL(file);
      } catch (error) {
        toast.error('Ошибка загрузки изображения');
      }
    }
    
    setUploading(false);
    e.target.value = '';
  };

  const handleImageClick = async (imageUrl: string) => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const item = new ClipboardItem({ [blob.type]: blob });
      await navigator.clipboard.write([item]);
      toast.success('Изображение скопировано!');
    } catch (error) {
      toast.error('Ошибка копирования изображения');
    }
  };

  const handleImageDelete = async (e: React.MouseEvent, imageId: number) => {
    e.stopPropagation();
    try {
      const response = await fetch(`https://functions.poehali.dev/98030051-bc07-464d-98f9-7504adfd39e1?id=${imageId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setImages(prev => prev.filter(img => img.id !== imageId));
        toast.success('Изображение удалено!');
      }
    } catch (error) {
      toast.error('Ошибка удаления изображения');
    }
  };

  return (
    <div className="min-h-screen bg-background p-2">
      <div className="max-w-[100vw] mx-auto">
        <Tabs value={activeTab.toString()} onValueChange={(v) => setActiveTab(Number(v))} className="w-full">
          <TabsList className="w-full justify-start overflow-x-auto bg-card mb-2 h-auto flex-wrap">
            {tabs.map((tab) => (
              <TabsTrigger
                key={tab.id}
                value={tab.id.toString()}
                className="text-[10px] md:text-xs px-2 py-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                {tab.name}
              </TabsTrigger>
            ))}
          </TabsList>

          {tabs.map((tab) => (
            <TabsContent key={tab.id} value={tab.id.toString()} className="mt-0">
              {tab.name === 'Картинки' ? (
                <div className="space-y-4">
                  <div className="flex justify-start">
                    <Button onClick={() => document.getElementById('image-upload')?.click()} disabled={uploading}>
                      <Icon name="Upload" size={16} className="mr-2" />
                      {uploading ? 'Загрузка...' : 'Загрузить'}
                    </Button>
                    <input
                      id="image-upload"
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={handleImageUpload}
                    />
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {images.map((image) => (
                      <div
                        key={image.id}
                        className="border border-border rounded-lg overflow-hidden bg-card hover:ring-2 hover:ring-primary transition-all cursor-pointer group"
                        onDoubleClick={() => handleImageClick(image.file_url)}
                      >
                        <div className="aspect-square relative">
                          <img
                            src={image.file_url}
                            alt={image.file_name}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                            <Icon name="Copy" size={24} className="text-white" />
                          </div>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 p-0"
                            onClick={(e) => handleImageDelete(e, image.id)}
                          >
                            <Icon name="Trash2" size={16} />
                          </Button>
                        </div>
                        <div className="p-2">
                          <p className="text-xs text-muted-foreground truncate">{image.file_name}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="border border-border rounded-lg overflow-auto bg-card">
                  <div className="min-w-max">
                    <div className="grid gap-[1px] bg-border p-[1px]" style={{ gridTemplateColumns: `repeat(${COLS}, 240px)` }}>
                      {Array.from({ length: COLS }, (_, i) => (
                        <div key={i} className="bg-muted text-muted-foreground text-xs font-medium p-2 text-center">
                          УРОК {i + 1}
                        </div>
                      ))}

                      {Array.from({ length: ROWS }, (_, row) => (
                        <>
                          {Array.from({ length: COLS }, (_, col) => {
                            const key = getCellKey(tab.id, row, col);
                            const cell = cells[key];
                            return (
                              <div
                                key={`${row}-${col}`}
                                className="bg-card hover:bg-accent transition-colors cursor-pointer p-2 min-h-[108px] group relative"
                                onClick={() => handleCellClick(row, col)}
                                onDoubleClick={() => handleCellDoubleClick(row, col)}
                              >
                                <div className="text-xs text-foreground line-clamp-6 whitespace-pre-wrap break-words">
                                  {cell?.content || ''}
                                </div>
                                {cell?.content && (
                                  <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Icon name="Copy" size={12} className="text-muted-foreground" />
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </div>

      <Dialog open={editingCell !== null} onOpenChange={(open) => !open && setEditingCell(null)}>
        <DialogContent className="bg-card">
          <DialogHeader>
            <DialogTitle>Редактировать ячейку</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              placeholder="Введите текст..."
              rows={6}
              className="resize-none bg-background"
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setEditingCell(null)}>
                Отмена
              </Button>
              <Button onClick={handleSaveCell}>
                Сохранить
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Index;