import { useState, useEffect } from 'react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { GripVertical } from 'lucide-react';
import { useCompany } from '@/hooks/useCompany';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ColumnConfig {
    id: string;
    label: string;
    visible: boolean;
    filterable?: boolean;
}

interface StoredConfig {
    id: string;
    visible: boolean;
    filterable?: boolean;
}

interface ColumnConfigDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    tableId: string;
    defaultColumns: { id: string; label: string; defaultHidden?: boolean }[];
    onConfigChange?: () => void;
}

function SortableItem({
    id,
    label,
    visible,
    filterable,
    onToggleVisible,
    onToggleFilterable
}: {
    id: string;
    label: string;
    visible: boolean;
    filterable: boolean;
    onToggleVisible: () => void;
    onToggleFilterable: () => void;
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
    } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className="flex items-center justify-between p-3 bg-card border rounded-md mb-2 gap-4"
        >
            <div className="flex items-center gap-3 min-w-0">
                <div {...attributes} {...listeners} className="cursor-grab text-muted-foreground hover:text-foreground shrink-0">
                    <GripVertical className="h-5 w-5" />
                </div>
                <span className="font-medium text-sm truncate">
                    {label}
                </span>
            </div>

            <div className="flex items-center gap-6 shrink-0">
                <div className="flex items-center gap-1.5">
                    <Checkbox
                        checked={visible}
                        onCheckedChange={onToggleVisible}
                        id={`col-vis-${id}`}
                    />
                    <label htmlFor={`col-vis-${id}`} className="text-xs text-muted-foreground cursor-pointer select-none">
                        Visible
                    </label>
                </div>

                <div className="flex items-center gap-1.5">
                    <Switch
                        checked={filterable}
                        onCheckedChange={onToggleFilterable}
                        id={`col-filt-${id}`}
                    />
                    <label htmlFor={`col-filt-${id}`} className="text-xs text-muted-foreground cursor-pointer select-none">
                        Filter
                    </label>
                </div>
            </div>
        </div>
    );
}

export function ColumnConfigDialog({
    open,
    onOpenChange,
    tableId,
    defaultColumns,
    onConfigChange
}: ColumnConfigDialogProps) {
    const { company, refetch: refetchCompany } = useCompany();
    const [columns, setColumns] = useState<ColumnConfig[]>([]);
    const [saving, setSaving] = useState(false);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    // Initialize/Sync columns when dialog opens or company data loads
    useEffect(() => {
        if (open && company) {
            const storedConfigs = (company.features as any)?.table_configs?.[tableId] as StoredConfig[] | undefined;

            let initialColumns: ColumnConfig[] = [];
            const isPredefinedFilter = (id: string) => id === 'owner' || id === 'status' || id === 'product_purchased';

            if (storedConfigs && Array.isArray(storedConfigs)) {
                // 1. Add stored columns in order
                initialColumns = storedConfigs.map(sc => {
                    const def = defaultColumns.find(dc => dc.id === sc.id);
                    return {
                        id: sc.id,
                        label: def?.label || sc.id, // Fallback if label missing (shouldn't happen often)
                        visible: sc.visible,
                        filterable: sc.filterable !== undefined ? sc.filterable : isPredefinedFilter(sc.id),
                    };
                }).filter(c => defaultColumns.some(dc => dc.id === c.id)); // Filter out columns that no longer exist in code

                // 2. Append any new columns from defaultColumns that weren't in storage
                const storedIds = new Set(storedConfigs.map(sc => sc.id));
                const newColumns = defaultColumns
                    .filter(dc => !storedIds.has(dc.id))
                    .map(dc => ({
                        id: dc.id,
                        label: dc.label,
                        visible: !dc.defaultHidden,
                        filterable: isPredefinedFilter(dc.id),
                    }));

                initialColumns = [...initialColumns, ...newColumns];
            } else {
                // No config stored, use defaults
                initialColumns = defaultColumns.map(dc => ({
                    id: dc.id,
                    label: dc.label,
                    visible: !dc.defaultHidden,
                    filterable: isPredefinedFilter(dc.id),
                }));
            }

            setColumns(initialColumns);
        }
    }, [open, company, tableId, defaultColumns]);

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            setColumns((items) => {
                const oldIndex = items.findIndex((i) => i.id === active.id);
                const newIndex = items.findIndex((i) => i.id === over.id);
                return arrayMove(items, oldIndex, newIndex);
            });
        }
    };

    const toggleVisibility = (id: string) => {
        setColumns(prev => prev.map(col =>
            col.id === id ? { ...col, visible: !col.visible } : col
        ));
    };

    const toggleFilterable = (id: string) => {
        setColumns(prev => prev.map(col =>
            col.id === id ? { ...col, filterable: !col.filterable } : col
        ));
    };

    const handleSave = async () => {
        if (!company) return;
        setSaving(true);
        try {
            const currentFeatures = (company.features as any) || {};
            const currentTableConfigs = currentFeatures.table_configs || {};

            // Prepare config to save: minimal data (id, visible, filterable)
            const configToSave = columns.map(({ id, visible, filterable }) => ({ id, visible, filterable }));

            const newFeatures = {
                ...currentFeatures,
                table_configs: {
                    ...currentTableConfigs,
                    [tableId]: configToSave
                }
            };

            const { error } = await supabase
                .from('companies')
                .update({ features: newFeatures })
                .eq('id', company.id);

            if (error) throw error;

            toast.success('List layout saved successfully');
            await refetchCompany(); // Reload company data to propagate changes
            if (onConfigChange) onConfigChange();
            onOpenChange(false);
        } catch (error) {
            console.error('Error saving column config:', error);
            toast.error('Failed to save layout');
        } finally {
            setSaving(false);
        }
    };

    const handleReset = () => {
        const isPredefinedFilter = (id: string) => id === 'owner' || id === 'status' || id === 'product_purchased';
        // Reset to default order, default visibility and default filters
        setColumns(defaultColumns.map(dc => ({
            id: dc.id,
            label: dc.label,
            visible: !dc.defaultHidden,
            filterable: isPredefinedFilter(dc.id)
        })));
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md max-h-[85vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Configure Columns</DialogTitle>
                    <DialogDescription>
                        Drag to reorder. Uncheck to hide. Changes apply to everyone in the company.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto py-4 pr-2">
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                    >
                        <SortableContext
                            items={columns.map(c => c.id)}
                            strategy={verticalListSortingStrategy}
                        >
                            {columns.map((column) => (
                                <SortableItem
                                    key={column.id}
                                    id={column.id}
                                    label={column.label}
                                    visible={column.visible}
                                    filterable={column.filterable || false}
                                    onToggleVisible={() => toggleVisibility(column.id)}
                                    onToggleFilterable={() => toggleFilterable(column.id)}
                                />
                            ))}
                        </SortableContext>
                    </DndContext>
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="outline" onClick={handleReset} type="button">
                        Reset Default
                    </Button>
                    <div className="flex gap-2">
                        <Button variant="ghost" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleSave} disabled={saving}>
                            {saving ? 'Saving...' : 'Save Changes'}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
