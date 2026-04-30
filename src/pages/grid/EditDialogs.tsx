import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

interface EditCellDialogProps {
  open: boolean;
  value: string;
  onChange: (val: string) => void;
  onSave: () => void;
  onClose: () => void;
}

interface EditColumnDialogProps {
  open: boolean;
  value: string;
  onChange: (val: string) => void;
  onSave: () => void;
  onClose: () => void;
}

export const EditCellDialog = ({ open, value, onChange, onSave, onClose }: EditCellDialogProps) => (
  <Dialog open={open} onOpenChange={onClose}>
    <DialogContent className="max-w-2xl">
      <DialogHeader>
        <DialogTitle>Редактировать ячейку</DialogTitle>
      </DialogHeader>
      <Textarea value={value} onChange={(e) => onChange(e.target.value)} rows={10} className="min-h-[200px]" placeholder="Введите текст..." />
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>Отмена</Button>
        <Button onClick={onSave}>Сохранить</Button>
      </div>
    </DialogContent>
  </Dialog>
);

export const EditColumnDialog = ({ open, value, onChange, onSave, onClose }: EditColumnDialogProps) => (
  <Dialog open={open} onOpenChange={onClose}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Изменить название колонки</DialogTitle>
      </DialogHeader>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full p-2 border border-border rounded-md bg-background text-foreground"
        placeholder="Название колонки"
      />
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>Отмена</Button>
        <Button onClick={onSave}>Сохранить</Button>
      </div>
    </DialogContent>
  </Dialog>
);
