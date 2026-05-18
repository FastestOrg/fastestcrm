import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Save, Trash, GripVertical, ArrowLeft, Eye, EyeOff, Check, Copy, Code, Sparkles, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useForm, useCreateForm, useUpdateForm } from '@/hooks/useForms';
import { extractFieldsFromImage } from '@/services/formAIService';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/hooks/useAuth';
import { useCompany } from '@/hooks/useCompany';
import { useUserRole } from '@/hooks/useUserRole';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { EDUCATION_LEAD_COLUMNS } from '@/industries/education/config';
import { REAL_ESTATE_LEAD_COLUMNS } from '@/industries/real_estate/config';
import { SAAS_LEAD_COLUMNS } from '@/industries/saas/config';
import { HEALTHCARE_LEAD_COLUMNS } from '@/industries/healthcare/config';
import { INSURANCE_LEAD_COLUMNS } from '@/industries/insurance/config';
import { TRAVEL_LEAD_COLUMNS } from '@/industries/travel/config';
import { useLeadStatuses } from '@/hooks/useLeadStatuses';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
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
    verticalListSortingStrategy,
    useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

type FieldType = 'text' | 'email' | 'phone' | 'number' | 'textarea' | 'select';

// List of available columns in the leads table for mapping
// Core attributes shared across all industries
// UTM fields are commonly needed but might not be in the industry config
const COMMON_UTM_ATTRIBUTES = [
    { label: 'UTM Source', value: 'utm_source' },
    { label: 'UTM Medium', value: 'utm_medium' },
    { label: 'UTM Campaign', value: 'utm_campaign' },
    { label: 'Notes', value: 'notes' },
];

interface FormField {
    id: string;
    label: string;
    type: FieldType;
    required: boolean;
    attribute: string; // Database column mapping
    hidden: boolean;
    defaultValue?: string;
    options?: string[]; // For select fields
}

interface SortableFieldProps {
    field: FormField;
    leadAttributes: { label: string; value: string }[];
    companyStatuses: any[];
    companyUsers: any[];
    updateField: (id: string, updates: Partial<FormField>) => void;
    removeField: (id: string) => void;
}

function SortableField({ field, leadAttributes, companyStatuses, companyUsers, updateField, removeField }: SortableFieldProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: field.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 1 : 0,
        position: isDragging ? 'relative' as const : undefined,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`flex items-start gap-4 p-4 rounded-lg border ${field.hidden ? 'border-dashed border-yellow-500/50 bg-yellow-500/5' : 'border-border bg-card/50'}`}
        >
            <div {...attributes} {...listeners} className="mt-3 cursor-move touch-none">
                <GripVertical className="h-5 w-5 text-muted-foreground" />
            </div>

            <div className="flex-1 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="grid gap-2">
                        <Label>Field Label</Label>
                        <Input
                            value={field.label}
                            onChange={(e) => updateField(field.id, { label: e.target.value })}
                            placeholder="e.g., Full Name"
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label>Field Type</Label>
                        <Select
                            value={field.type}
                            onValueChange={(value) => updateField(field.id, { type: value as FieldType })}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="text">Text</SelectItem>
                                <SelectItem value="email">Email</SelectItem>
                                <SelectItem value="phone">Phone</SelectItem>
                                <SelectItem value="number">Number</SelectItem>
                                <SelectItem value="textarea">Text Area</SelectItem>
                                <SelectItem value="select">Dropdown</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="grid gap-2">
                        <Label>Map to Database Column</Label>
                        <Select
                            value={field.attribute}
                            onValueChange={(value) => updateField(field.id, { attribute: value })}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select attribute" />
                            </SelectTrigger>
                            <SelectContent>
                                {leadAttributes.map((attr) => (
                                    <SelectItem key={attr.value} value={attr.value}>
                                        {attr.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex items-center gap-6 mt-8">
                        <div className="flex items-center gap-2">
                            <Switch
                                checked={field.required}
                                onCheckedChange={(checked) => updateField(field.id, { required: checked })}
                                disabled={field.hidden}
                            />
                            <Label>Required</Label>
                        </div>
                        <div className="flex items-center gap-2">
                            <Switch
                                checked={field.hidden}
                                onCheckedChange={(checked) => updateField(field.id, { hidden: checked, required: checked ? false : field.required })}
                            />
                            <Label className="flex items-center gap-1">
                                {field.hidden ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                                Hidden
                            </Label>
                        </div>
                    </div>
                </div>

                {field.hidden && (
                    <div className="grid gap-2 p-3 bg-yellow-500/10 rounded-md">
                        <Label className="text-yellow-600">Default Value (Prefilled)</Label>
                        {field.attribute === 'status' ? (
                            <Select
                                value={field.defaultValue || ''}
                                onValueChange={(value) => updateField(field.id, { defaultValue: value })}
                            >
                                <SelectTrigger className="border-yellow-500/20">
                                    <SelectValue placeholder="Select Status" />
                                </SelectTrigger>
                                <SelectContent>
                                    {companyStatuses?.map((status) => (
                                        <SelectItem key={status.value} value={status.value}>
                                            {status.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        ) : field.attribute === 'sales_owner_id' ? (
                            <Select
                                value={field.defaultValue || ''}
                                onValueChange={(value) => updateField(field.id, { defaultValue: value })}
                            >
                                <SelectTrigger className="border-yellow-500/20">
                                    <SelectValue placeholder="Select Lead Owner" />
                                </SelectTrigger>
                                <SelectContent>
                                    {companyUsers?.map((user) => (
                                        <SelectItem key={user.id} value={user.id}>
                                            {user.full_name || user.email}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        ) : (
                            <Input
                                value={field.defaultValue || ''}
                                onChange={(e) => updateField(field.id, { defaultValue: e.target.value })}
                                placeholder="Enter value to be submitted automatically"
                                className="border-yellow-500/20"
                            />
                        )}
                        <p className="text-xs text-muted-foreground">This value will be submitted with the form but hidden from the user.</p>
                    </div>
                )}
            </div>
            <Button variant="ghost" size="icon" className="text-destructive mt-1" onClick={() => removeField(field.id)}>
                <Trash className="h-4 w-4" />
            </Button>
        </div>
    );
}

export default function FormBuilder() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { company } = useCompany();
    const { statuses: companyStatuses } = useLeadStatuses();

    // Fetch company users for Lead Owner selection
    const { data: companyUsers } = useQuery({
        queryKey: ['company-users', company?.id],
        queryFn: async () => {
            if (!company?.id) return [];
            const { data } = await supabase
                .from('profiles')
                .select('id, full_name, email')
                .eq('company_id', company.id)
                .not('full_name', 'is', null);
            return data || [];
        },
        enabled: !!company?.id
    });

    // Dynamically determine available attributes based on industry
    const leadAttributes = (() => {
        let columns;

        if (company?.industry === 'real_estate') {
            columns = REAL_ESTATE_LEAD_COLUMNS;
        } else if (company?.industry === 'saas') {
            columns = SAAS_LEAD_COLUMNS;
        } else if (company?.industry === 'healthcare') {
            columns = HEALTHCARE_LEAD_COLUMNS;
        } else if (company?.industry === 'insurance') {
            columns = INSURANCE_LEAD_COLUMNS;
        } else if (company?.industry === 'travel') {
            columns = TRAVEL_LEAD_COLUMNS;
        } else {
            // Default to Education / Generic if no industry or education
            columns = EDUCATION_LEAD_COLUMNS;
        }

        // Map columns to form builder format
        const industryAttrs = columns
            //.filter((col: any) => col.key !== 'status') // Don't exclude status anymore
            .map((col: any) => ({ label: col.label, value: col.key }));

        // Add common UTM fields and explicit Status field if not already there
        const commonAttrs = [...COMMON_UTM_ATTRIBUTES];

        // Ensure Status is available
        if (!industryAttrs.find((a: any) => a.value === 'status')) {
            commonAttrs.push({ label: 'Lead Status', value: 'status' });
        }

        // Ensure Lead Source is available
        if (!industryAttrs.find((a: any) => a.value === 'lead_source')) {
            commonAttrs.push({ label: 'Lead Source', value: 'lead_source' });
        }

        // Ensure Lead Owner is available
        if (!industryAttrs.find((a: any) => a.value === 'sales_owner_id')) {
            commonAttrs.push({ label: 'Lead Owner', value: 'sales_owner_id' });
        }

        return [...industryAttrs, ...commonAttrs];
    })();

    const { data: existingForm, isLoading } = useForm(id);
    const createForm = useCreateForm();
    const updateForm = useUpdateForm();
    const { data: userRole } = useUserRole();

    const [showApiInfo, setShowApiInfo] = useState(false);
    const [copiedUrl, setCopiedUrl] = useState(false);
    const [copiedJson, setCopiedJson] = useState(false);
    const [isExtracting, setIsExtracting] = useState(false);

    const apiUrl = `https://api.fastestcrm.com/functions/v1/submit-external-lead`;
    const canViewApiInfo = (userRole === 'company' || userRole === 'company_subadmin');

    // Generate sample JSON payload based on current fields
    const generateJsonPayload = () => {
        const payload: any = {
            formId: id || "YOUR_FORM_ID",
            data: {}
        };

        fields.forEach(field => {
            if (field.attribute) {
                // Generate dummy data based on type/attribute
                let dummyValue: any = "value";

                if (field.attribute === 'email') dummyValue = "user@example.com";
                else if (field.attribute === 'phone') dummyValue = "9876543210";
                else if (field.attribute === 'whatsapp') dummyValue = "9876543210";
                else if (field.type === 'number' || field.attribute.includes('budget') || field.attribute === 'cgpa') dummyValue = 123;
                else if (field.attribute === 'name') dummyValue = "John Doe";
                else if (field.attribute.includes('date')) dummyValue = "2024-01-01";
                else if (field.attribute === 'status') dummyValue = "new";

                payload.data[field.attribute] = dummyValue;
            }
        });

        // Add common UTM fields if not present as explicit fields
        if (!Object.keys(payload.data).includes('utm_source')) payload.data.utm_source = "google";
        if (!Object.keys(payload.data).includes('utm_medium')) payload.data.utm_medium = "cpc";

        return JSON.stringify(payload, null, 2);
    };

    const copyToClipboard = (text: string, isUrl: boolean) => {
        navigator.clipboard.writeText(text);
        if (isUrl) {
            setCopiedUrl(true);
            setTimeout(() => setCopiedUrl(false), 2000);
        } else {
            setCopiedJson(true);
            setTimeout(() => setCopiedJson(false), 2000);
        }
    };


    const [formName, setFormName] = useState('New Form');
    const [description, setDescription] = useState('');
    const [fields, setFields] = useState<FormField[]>([
        { id: '1', label: 'Full Name', type: 'text', required: true, attribute: 'name', hidden: false },
        { id: '2', label: 'Email Address', type: 'email', required: true, attribute: 'email', hidden: false },
        { id: '3', label: 'Phone Number', type: 'phone', required: true, attribute: 'phone', hidden: false },
    ]);

    useEffect(() => {
        if (existingForm) {
            setFormName(existingForm.name);
            setDescription(existingForm.description || '');
            if (existingForm.fields && Array.isArray(existingForm.fields)) {
                setFields(existingForm.fields as any as FormField[]);
            }
        }
    }, [existingForm]);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            setFields((items) => {
                const oldIndex = items.findIndex((item) => item.id === active.id);
                const newIndex = items.findIndex((item) => item.id === over.id);
                return arrayMove(items, oldIndex, newIndex);
            });
        }
    };

    const addField = () => {
        const newField: FormField = {
            id: Date.now().toString(),
            label: 'New Field',
            type: 'text',
            required: false,
            attribute: '',
            hidden: false
        };
        setFields([...fields, newField]);
    };

    const removeField = (id: string) => {
        setFields(fields.filter(f => f.id !== id));
    };

    const updateField = (id: string, updates: Partial<FormField>) => {
        setFields(fields.map(f => f.id === id ? { ...f, ...updates } : f));
    };

    const handleSave = async () => {
        if (!user) {
            toast.error('You must be logged in to save forms');
            return;
        }

        if (!formName.trim()) {
            toast.error('Form name is required');
            return;
        }

        try {
            const formData = {
                name: formName,
                description,
                fields: fields as any, // Cast to any for Json type compatibility
                created_by_id: user.id,
                status: 'active'
            };

            if (id) {
                await updateForm.mutateAsync({ id, ...formData });
                toast.success('Form updated successfully');
            } else {
                await createForm.mutateAsync(formData);
                toast.success('Form created successfully');
            }
            navigate('/dashboard/forms');
        } catch (error) {
            console.error(error);
            toast.error('Failed to save form');
        }
    };

    const handleImportFromImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !company?.id) return;

        setIsExtracting(true);
        try {
            const extracted = await extractFieldsFromImage({
                companyId: company.id,
                file,
                availableAttributes: leadAttributes
            });

            const newFields = extracted.map(f => ({
                id: Math.random().toString(36).substr(2, 9),
                label: f.label,
                type: f.type,
                required: f.required,
                attribute: f.attribute,
                hidden: false,
                options: f.options
            }));

            setFields(prev => [...prev, ...newFields]);
            toast.success(`AI successfully extracted ${extracted.length} fields!`);
        } catch (error) {
            console.error('Extraction failed', error);
            toast.error('Failed to extract fields. Is your Gemini key active?');
        } finally {
            setIsExtracting(false);
            if (e.target) e.target.value = '';
        }
    };

    if (id && isLoading) {
        return (
            <>
                <div className="p-8 flex items-center justify-center">
                    <p>Loading form...</p>
                </div>
            </>
        );
    }

    return (
        <>
            <div className="p-8 space-y-8">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard/forms')}>
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                        <div>
                            <h1 className="text-2xl font-bold">{id ? 'Edit Form' : 'Create New Form'}</h1>
                            <p className="text-muted-foreground">Design your lead capture form.</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {canViewApiInfo && id && (
                            <Dialog open={showApiInfo} onOpenChange={setShowApiInfo}>
                                <DialogTrigger asChild>
                                    <Button variant="outline" className="gap-2 border-dashed">
                                        <Code className="h-4 w-4" />
                                        API Info
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                                    <DialogHeader>
                                        <DialogTitle>API Integration Details</DialogTitle>
                                        <DialogDescription>
                                            Use these details to integrate your external landing pages.
                                        </DialogDescription>
                                    </DialogHeader>

                                    <div className="space-y-6 py-4">
                                        <div className="space-y-2">
                                            <Label>API Endpoint URL</Label>
                                            <div className="flex items-center gap-2">
                                                <code className="flex-1 bg-muted p-3 rounded-md text-sm font-mono break-all">
                                                    {apiUrl}
                                                </code>
                                                <Button size="icon" variant="outline" onClick={() => copyToClipboard(apiUrl, true)}>
                                                    {copiedUrl ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                                                </Button>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <Label>Sample JSON Payload</Label>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="h-8 gap-2"
                                                    onClick={() => copyToClipboard(generateJsonPayload(), false)}
                                                >
                                                    {copiedJson ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                                                    {copiedJson ? 'Copied' : 'Copy JSON'}
                                                </Button>
                                            </div>
                                            <div className="relative">
                                                <pre className="bg-slate-950 text-slate-50 p-4 rounded-md text-sm font-mono overflow-auto max-h-[400px]">
                                                    {generateJsonPayload()}
                                                </pre>
                                            </div>
                                            <p className="text-xs text-muted-foreground mt-2">
                                                Note: Ensure <code>formId</code> matches this form ID. Field keys must match the mapped attributes.
                                            </p>
                                        </div>
                                    </div>
                                </DialogContent>
                            </Dialog>
                        )}
                        <Button onClick={handleSave} className="gradient-primary">
                            <Save className="h-4 w-4 mr-2" />
                            Save Form
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Form Settings */}
                    <Card className="glass h-fit">
                        <CardHeader>
                            <CardTitle>Form Settings</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid gap-2">
                                <Label htmlFor="formName">Form Name</Label>
                                <Input
                                    id="formName"
                                    value={formName}
                                    onChange={(e) => setFormName(e.target.value)}
                                    placeholder="e.g., Webinar Registration"
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label>Description</Label>
                                <Input
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Enter form description"
                                />
                            </div>

                            <div className="pt-4 border-t border-border/50">
                                <Label className="text-primary font-bold flex items-center gap-2 mb-3">
                                   <Sparkles className="h-4 w-4" /> AI Magic Onboarding
                                </Label>
                                <div className="space-y-3">
                                    <p className="text-[10px] text-muted-foreground leading-tight">
                                        Upload a photo or PDF of your physical registration form. Our AI will build the digital version instantly.
                                    </p>
                                    <div className="relative">
                                        <Input
                                            type="file"
                                            accept="image/*,application/pdf"
                                            className="opacity-0 absolute inset-0 w-full h-full cursor-pointer z-10"
                                            onChange={handleImportFromImage}
                                            disabled={isExtracting}
                                        />
                                        <Button variant="outline" className="w-full gap-2 border-primary/20 bg-primary/5 hover:bg-primary/10" disabled={isExtracting}>
                                            {isExtracting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                                            {isExtracting ? 'Extracting Fields...' : 'Import from Paper Form'}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Field Builder */}
                    <Card className="glass lg:col-span-2">
                        <CardHeader>
                            <CardTitle>Form Fields</CardTitle>
                            <CardDescription>Add and configure fields for your form.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <DndContext
                                sensors={sensors}
                                collisionDetection={closestCenter}
                                onDragEnd={handleDragEnd}
                            >
                                <SortableContext
                                    items={fields.map(f => f.id)}
                                    strategy={verticalListSortingStrategy}
                                >
                                    {fields.map((field) => (
                                        <SortableField
                                            key={field.id}
                                            field={field}
                                            leadAttributes={leadAttributes}
                                            companyStatuses={companyStatuses || []}
                                            companyUsers={companyUsers || []}
                                            updateField={updateField}
                                            removeField={removeField}
                                        />
                                    ))}
                                </SortableContext>
                            </DndContext>

                            <Button variant="outline" className="w-full border-dashed" onClick={addField}>
                                <Plus className="h-4 w-4 mr-2" />
                                Add Field
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div >
        </>
    );

}
