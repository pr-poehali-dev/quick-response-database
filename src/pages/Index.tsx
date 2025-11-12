import { useState, useEffect, useCallback, FC } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import Icon from '@/components/ui/icon';

interface LazyImageProps {
  imageId: number;
  fileName: string;
  onImageClick: (url: string) => void;
  onDeleteClick: (e: React.MouseEvent, id: number) => void;
  loadImageData: (id: number) => Promise<string | null>;
}

const LazyImage: FC<LazyImageProps> = ({ imageId, fileName, onImageClick, onDeleteClick, loadImageData }) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const url = await loadImageData(imageId);
      setImageUrl(url);
      setLoading(false);
    };
    load();
  }, [imageId, loadImageData]);

  return (
    <div
      className="border border-border rounded-lg overflow-hidden bg-card hover:ring-2 hover:ring-primary transition-all cursor-pointer group"
      onDoubleClick={() => imageUrl && onImageClick(imageUrl)}
    >
      <div className="aspect-square relative">
        {loading ? (
          <div className="w-full h-full flex items-center justify-center bg-muted">
            <Icon name="Loader2" className="animate-spin" size={24} />
          </div>
        ) : imageUrl ? (
          <>
            <img
              src={imageUrl}
              alt={fileName}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
              <Icon name="Copy" size={24} className="text-white" />
            </div>
            <Button
              size="sm"
              variant="destructive"
              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 p-0"
              onClick={(e) => onDeleteClick(e, imageId)}
            >
              <Icon name="Trash2" size={16} />
            </Button>
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-muted text-muted-foreground">
            <Icon name="ImageOff" size={24} />
          </div>
        )}
      </div>
      <div className="p-2">
        <p className="text-xs text-muted-foreground truncate">{fileName}</p>
      </div>
    </div>
  );
};

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
  file_url: string | null;
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
  const [deleteImageId, setDeleteImageId] = useState<number | null>(null);
  const [columnNames, setColumnNames] = useState<Record<number, string>>({});
  const [editingColumn, setEditingColumn] = useState<number | null>(null);
  const [editColumnValue, setEditColumnValue] = useState('');
  const [imageCache, setImageCache] = useState<Record<number, string>>({});

  const getCellKey = (tabId: number, row: number, col: number) => `${tabId}-${row}-${col}`;

  useEffect(() => {
    loadTabs();
    const savedColumns = localStorage.getItem('columnNames');
    if (savedColumns) {
      setColumnNames(JSON.parse(savedColumns));
    }
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
  }, [activeTab, tabs]);

  const loadTabs = async () => {
    try {
      const response = await fetch('https://functions.poehali.dev/86104f38-169c-4ce4-b077-38f1883a61c5');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      setTabs(data.tabs || []);
      if (data.tabs && data.tabs.length > 0) {
        setActiveTab(data.tabs[0].id);
        localStorage.setItem('tabs_backup', JSON.stringify(data.tabs));
      }
    } catch (error) {
      const savedTabs = localStorage.getItem('tabs_backup');
      if (savedTabs) {
        const parsedTabs = JSON.parse(savedTabs);
        setTabs(parsedTabs);
        if (parsedTabs.length > 0) {
          setActiveTab(parsedTabs[0].id);
        }
        toast('Работаем с сохраненными данными', { icon: '💾' });
      } else {
        const defaultTabs = [
          { id: 1, name: 'УПРАЖНЕНИЯ', position: 1 },
          { id: 2, name: 'Картинки', position: 2 }
        ];
        setTabs(defaultTabs);
        setActiveTab(1);
        localStorage.setItem('tabs_backup', JSON.stringify(defaultTabs));
        toast('Работаем в автономном режиме', { icon: '📴' });
      }
    }
  };

  const loadCells = async (tabId: number) => {
    try {
      setLoading(true);
      
      const cachedData = localStorage.getItem(`cells_tab_${tabId}`);
      if (cachedData) {
        const cellsMap: Record<string, Cell> = JSON.parse(cachedData);
        setCells(cellsMap);
        setLoading(false);
      }
      
      const response = await fetch(`https://functions.poehali.dev/f2f9a3f0-13c8-4862-8b02-aea4ab6b62d4?tab_id=${tabId}`);
      const data = await response.json();
      const cellsMap: Record<string, Cell> = {};
      (data.cells || []).forEach((cell: Cell) => {
        const key = getCellKey(tabId, cell.row_index, cell.col_index);
        cellsMap[key] = cell;
      });
      setCells(cellsMap);
      localStorage.setItem(`cells_tab_${tabId}`, JSON.stringify(cellsMap));
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
        const updatedCells = {
          ...cells,
          [key]: {
            tab_id: activeTab,
            row_index: editingCell.row,
            col_index: editingCell.col,
            content: editValue,
          }
        };
        setCells(updatedCells);
        localStorage.setItem(`cells_tab_${activeTab}`, JSON.stringify(updatedCells));
        toast.success('Сохранено!');
      }
    } catch (error) {
      toast.error('Ошибка сохранения');
    } finally {
      setEditingCell(null);
      setEditValue('');
    }
  };

  const handleColumnDoubleClick = (colIndex: number) => {
    setEditColumnValue(columnNames[colIndex] || `УРОК ${colIndex + 1}`);
    setEditingColumn(colIndex);
  };

  const handleSaveColumnName = () => {
    if (editingColumn === null) return;
    
    const newColumnNames = {
      ...columnNames,
      [editingColumn]: editColumnValue
    };
    setColumnNames(newColumnNames);
    localStorage.setItem('columnNames', JSON.stringify(newColumnNames));
    setEditingColumn(null);
    setEditColumnValue('');
    toast.success('Название колонки сохранено!');
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

  const loadImageData = useCallback(async (imageId: number) => {
    if (imageCache[imageId]) {
      return imageCache[imageId];
    }

    try {
      const response = await fetch(`https://functions.poehali.dev/98030051-bc07-464d-98f9-7504adfd39e1?id=${imageId}`);
      const data = await response.json();
      
      if (data.image && data.image.file_url) {
        setImageCache(prev => ({ ...prev, [imageId]: data.image.file_url }));
        return data.image.file_url;
      }
    } catch (error) {
      console.error('Ошибка загрузки данных изображения:', error);
    }
    
    return null;
  }, [imageCache]);

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
            const result = await response.json();
            if (result.image) {
              setImageCache(prev => ({ ...prev, [result.image.id]: result.image.file_url }));
            }
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
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = imageUrl;
      
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });
      
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0);
      
      canvas.toBlob(async (blob) => {
        if (blob) {
          const item = new ClipboardItem({ 'image/png': blob });
          await navigator.clipboard.write([item]);
          toast.success('Изображение скопировано!');
        }
      }, 'image/png');
    } catch (error) {
      toast.error('Ошибка копирования изображения');
    }
  };

  const handleImageDeleteClick = (e: React.MouseEvent, imageId: number) => {
    e.stopPropagation();
    setDeleteImageId(imageId);
  };

  const handleImageDeleteConfirm = async () => {
    if (!deleteImageId) return;
    
    try {
      const response = await fetch(`https://functions.poehali.dev/98030051-bc07-464d-98f9-7504adfd39e1?id=${deleteImageId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setImages(prev => prev.filter(img => img.id !== deleteImageId));
        toast.success('Изображение удалено!');
      }
    } catch (error) {
      toast.error('Ошибка удаления изображения');
    } finally {
      setDeleteImageId(null);
    }
  };

  return (
    <div className="min-h-screen bg-background p-2 md:p-2 pb-12 md:pb-2">
      <div className="max-w-[100vw] mx-auto flex flex-col h-screen md:h-auto">
        <Tabs value={activeTab.toString()} onValueChange={(v) => setActiveTab(Number(v))} className="w-full flex flex-col h-full md:h-auto">
          <TabsList className="w-full justify-center md:justify-start overflow-x-auto bg-card mb-12 md:mb-2 h-auto flex-wrap order-2 md:order-1 mt-2 md:mt-0">
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
            <TabsContent key={tab.id} value={tab.id.toString()} className="mt-0 order-1 md:order-2 flex-1 md:flex-none">
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
                      <LazyImage
                        key={image.id}
                        imageId={image.id}
                        fileName={image.file_name}
                        onImageClick={handleImageClick}
                        onDeleteClick={handleImageDeleteClick}
                        loadImageData={loadImageData}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <div 
                  className="border border-border rounded-lg overflow-x-auto overflow-y-auto bg-card h-[calc(100vh-8rem)] md:h-auto md:max-h-none md:overflow-y-hidden [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
                  onWheel={(e) => {
                    if (window.innerWidth >= 768 && Math.abs(e.deltaY) > 0) {
                      e.preventDefault();
                      e.stopPropagation();
                      const container = e.currentTarget;
                      container.scrollLeft += e.deltaY;
                      return false;
                    }
                  }}
                >
                  <div className="min-w-max">
                    <div className="grid gap-[1px] md:gap-[2px] bg-border p-[1px] md:p-[2px]" style={{ gridTemplateColumns: `repeat(${COLS}, ${window.innerWidth >= 768 ? '320px' : '264px'})` }}>
                      {Array.from({ length: COLS }, (_, i) => (
                        <div 
                          key={i} 
                          className="bg-muted text-muted-foreground text-sm md:text-sm font-medium p-2 md:p-3 text-center cursor-pointer hover:bg-muted/80 transition-colors"
                          onDoubleClick={() => handleColumnDoubleClick(i)}
                        >
                          {columnNames[i] || `УРОК ${i + 1}`}
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
                                className="bg-card hover:bg-accent transition-colors cursor-pointer p-2 md:p-3 min-h-[89px] md:min-h-[105px] group relative"
                                onClick={() => handleCellClick(row, col)}
                                onDoubleClick={() => handleCellDoubleClick(row, col)}
                              >
                                <div className="text-sm md:text-sm text-foreground line-clamp-6 whitespace-pre-wrap break-words">
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
        <DialogContent className="bg-card md:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Редактировать ячейку</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              placeholder="Введите текст..."
              rows={18}
              className="resize-none bg-background md:min-h-[500px]"
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

      <AlertDialog open={deleteImageId !== null} onOpenChange={(open) => !open && setDeleteImageId(null)}>
        <AlertDialogContent className="bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить изображение?</AlertDialogTitle>
            <AlertDialogDescription>
              Это действие нельзя отменить. Изображение будет удалено навсегда.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteImageId(null)}>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleImageDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={editingColumn !== null} onOpenChange={(open) => !open && setEditingColumn(null)}>
        <DialogContent className="bg-card">
          <DialogHeader>
            <DialogTitle>Переименовать колонку</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <input
              type="text"
              value={editColumnValue}
              onChange={(e) => setEditColumnValue(e.target.value)}
              placeholder="Название колонки..."
              className="w-full p-2 rounded bg-background border border-border text-foreground"
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setEditingColumn(null)}>
                Отмена
              </Button>
              <Button onClick={handleSaveColumnName}>
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