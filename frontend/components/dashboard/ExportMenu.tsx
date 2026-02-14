'use client'

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Download } from 'lucide-react'
import { useTranslations } from 'next-intl'

interface ExportMenuProps {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: any
}

export function ExportMenu({ data }: ExportMenuProps) {
    const t = useTranslations('dashboard')

    const exportCSV = () => {
        const rows: string[][] = []

        rows.push(['Section', 'Metric', 'Value'])

        // Financial - Month to Date
        rows.push(['Financial (MTD)', 'Revenue (cents)', String(data.financial.month_to_date.revenue_cents)])
        rows.push(['Financial (MTD)', 'Expenses (cents)', String(data.financial.month_to_date.expenses_cents)])
        rows.push(['Financial (MTD)', 'Net Profit (cents)', String(data.financial.month_to_date.net_profit_cents)])

        // Financial - Year to Date
        rows.push(['Financial (YTD)', 'Revenue (cents)', String(data.financial.year_to_date.revenue_cents)])
        rows.push(['Financial (YTD)', 'Expenses (cents)', String(data.financial.year_to_date.expenses_cents)])
        rows.push(['Financial (YTD)', 'Net Profit (cents)', String(data.financial.year_to_date.net_profit_cents)])

        // Production
        rows.push(['Production', 'Active Projects', String(data.production.active_projects)])
        rows.push(['Production', 'Total Projects', String(data.production.total_projects)])
        if (data.production.by_status) {
            for (const [status, count] of Object.entries(data.production.by_status)) {
                rows.push(['Production', `Status: ${status}`, String(count)])
            }
        }

        // Inventory
        rows.push(['Inventory', 'Health Score', String(data.inventory.inventory_health_score)])
        rows.push(['Inventory', 'Total Items', String(data.inventory.total_items)])
        rows.push(['Inventory', 'Needs Service', String(data.inventory.needs_service)])

        const csvContent = rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n')
        const blob = new Blob([csvContent], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = 'dashboard-export.csv'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
    }

    const exportPDF = async () => {
        const { default: jsPDF } = await import('jspdf')
        const { default: autoTable } = await import('jspdf-autotable')

        const doc = new jsPDF()

        // Title
        doc.setFontSize(18)
        doc.text('Produzo Dashboard Report', 14, 22)

        // Date
        doc.setFontSize(10)
        doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 30)

        let yPos = 40

        // Financial Overview
        doc.setFontSize(14)
        doc.text('Financial Overview', 14, yPos)
        yPos += 6

        autoTable(doc, {
            startY: yPos,
            head: [['Period', 'Revenue (cents)', 'Expenses (cents)', 'Net Profit (cents)']],
            body: [
                ['Month to Date', String(data.financial.month_to_date.revenue_cents), String(data.financial.month_to_date.expenses_cents), String(data.financial.month_to_date.net_profit_cents)],
                ['Year to Date', String(data.financial.year_to_date.revenue_cents), String(data.financial.year_to_date.expenses_cents), String(data.financial.year_to_date.net_profit_cents)],
            ],
        })

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        yPos = (doc as any).lastAutoTable.finalY + 14

        // Production Overview
        doc.setFontSize(14)
        doc.text('Production Overview', 14, yPos)
        yPos += 6

        const productionBody: string[][] = [
            ['Active Projects', String(data.production.active_projects)],
            ['Total Projects', String(data.production.total_projects)],
        ]
        if (data.production.by_status) {
            for (const [status, count] of Object.entries(data.production.by_status)) {
                productionBody.push([`Status: ${status}`, String(count)])
            }
        }

        autoTable(doc, {
            startY: yPos,
            head: [['Metric', 'Value']],
            body: productionBody,
        })

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        yPos = (doc as any).lastAutoTable.finalY + 14

        // Inventory Health
        doc.setFontSize(14)
        doc.text('Inventory Health', 14, yPos)
        yPos += 6

        autoTable(doc, {
            startY: yPos,
            head: [['Metric', 'Value']],
            body: [
                ['Health Score', String(data.inventory.inventory_health_score)],
                ['Total Items', String(data.inventory.total_items)],
                ['Needs Service', String(data.inventory.needs_service)],
            ],
        })

        doc.save('dashboard-report.pdf')
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline">
                    <Download className="mr-2 h-4 w-4" />
                    {t('exportData')}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
                <DropdownMenuItem onClick={exportCSV}>
                    {t('exportCSV')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportPDF}>
                    {t('exportPDF')}
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
