'use client'

import { Plus, Trash2, DollarSign, GripVertical, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ProposalLineItem } from '@/types'
import { v4 as uuidv4 } from 'uuid'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface FinancialLinesPanelProps {
    items: ProposalLineItem[]
    onChange: (items: ProposalLineItem[]) => void
    currency?: string
}

export function FinancialLinesPanel({ items, onChange, currency = 'BRL' }: FinancialLinesPanelProps) {
    const addItem = () => {
        const newItem: ProposalLineItem = {
            id: uuidv4(),
            description: '',
            value_cents: 0
        }
        onChange([...items, newItem])
    }

    const removeItem = (id: string) => {
        onChange(items.filter(item => item.id !== id))
    }

    const updateItem = (id: string, field: keyof ProposalLineItem, value: string | number) => {
        onChange(items.map(item => {
            if (item.id === id) {
                return { ...item, [field]: value }
            }
            return item
        }))
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Custom Line Items</h3>
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Add specific costs like equipment, travel, or manual adjustments.</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addItem}
                    className="h-8 group border-primary/20 hover:border-primary/50 hover:bg-primary/5 transition-all duration-200"
                >
                    <Plus className="mr-2 h-4 w-4 text-primary group-hover:scale-110 transition-transform" />
                    Add Item
                </Button>
            </div>

            <div className="rounded-xl border border-muted/60 bg-card/50 overflow-hidden shadow-sm">
                {items.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                        <div className="bg-muted/30 p-3 rounded-full mb-3">
                            <DollarSign className="h-6 w-6 text-muted-foreground/60" />
                        </div>
                        <p className="text-sm font-medium text-foreground">No custom items yet</p>
                        <p className="text-xs text-muted-foreground max-w-[200px] mt-1">
                            Add extra costs to your proposal for a more precise budget.
                        </p>
                    </div>
                ) : (
                    <div className="divide-y divide-muted/40">
                        {/* Header - Visible on Desktop */}
                        <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-2 bg-muted/20 text-[10px] uppercase font-bold text-muted-foreground tracking-widest">
                            <div className="col-span-1 flex justify-center">#</div>
                            <div className="col-span-8 px-1">Description</div>
                            <div className="col-span-2 px-1 text-right">Value ({currency})</div>
                            <div className="col-span-1"></div>
                        </div>

                        {items.map((item, index) => (
                            <div
                                key={item.id}
                                className="group grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-4 items-center px-3 py-3 md:px-4 md:py-2.5 hover:bg-muted/10 transition-colors"
                                style={{ animation: 'slideIn 0.2s ease-out' }}
                            >
                                {/* Index / Drag Handle area */}
                                <div className="hidden md:flex col-span-1 justify-center items-center">
                                    <span className="text-xs font-mono text-muted-foreground/60 group-hover:hidden">{index + 1}</span>
                                    <GripVertical className="h-4 w-4 text-muted-foreground/30 hidden group-hover:block cursor-grab active:cursor-grabbing" />
                                </div>

                                {/* Mobile Label for Description */}
                                <div className="md:col-span-8 flex flex-col gap-1.5">
                                    <Label htmlFor={`desc-${item.id}`} className="md:hidden text-[10px] uppercase font-bold text-muted-foreground">Description</Label>
                                    <Input
                                        id={`desc-${item.id}`}
                                        placeholder="e.g., Equipment Rental, Local Transport..."
                                        value={item.description}
                                        onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                                        className="h-11 text-base border-transparent bg-transparent hover:bg-background/80 focus:bg-background focus:border-primary/30 transition-all shadow-none"
                                    />
                                </div>

                                {/* Mobile Label for Value */}
                                <div className="md:col-span-2 flex flex-col gap-1.5">
                                    <Label htmlFor={`val-${item.id}`} className="md:hidden text-[10px] uppercase font-bold text-muted-foreground">Value ({currency})</Label>
                                    <div className="relative min-w-[120px]">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-bold">{currency === 'USD' ? '$' : currency === 'EUR' ? '€' : 'R$'}</span>
                                        <Input
                                            id={`val-${item.id}`}
                                            type="number"
                                            step="0.01"
                                            placeholder="0.00"
                                            value={item.value_cents / 100 || ''}
                                            onChange={(e) => {
                                                const val = parseFloat(e.target.value) || 0
                                                updateItem(item.id, 'value_cents', Math.round(val * 100))
                                            }}
                                            className="pl-10 h-11 text-base border-transparent bg-muted/30 md:text-right hover:bg-muted/50 focus:bg-background focus:border-primary/30 transition-all shadow-none font-bold"
                                        />
                                    </div>
                                </div>

                                <div className="md:col-span-1 flex justify-end">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => removeItem(item.id)}
                                        className="h-8 w-8 text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <style jsx>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
        </div>
    )
}
