import ExcelJS from 'exceljs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'RoyalHouse'
  workbook.subject = 'Developer apartment inventory import template'
  workbook.created = new Date()

  const sheet = workbook.addWorksheet('Xonadonlar')
  sheet.columns = [
    { header: 'unit_no', key: 'unit_no', width: 18 },
    { header: 'floor', key: 'floor', width: 12 },
    { header: 'rooms', key: 'rooms', width: 12 },
    { header: 'area_m2', key: 'area_m2', width: 14 },
    { header: 'price', key: 'price', width: 18 },
    { header: 'currency', key: 'currency', width: 14 },
    { header: 'plan_url', key: 'plan_url', width: 42 },
  ]
  sheet.views = [{ state: 'frozen', ySplit: 1 }]
  sheet.autoFilter = { from: 'A1', to: 'G1' }
  sheet.getRow(1).font = { bold: true }
  sheet.getRow(1).height = 24

  const guide = workbook.addWorksheet('Yo‘riqnoma')
  guide.columns = [{ width: 28 }, { width: 90 }]
  guide.addRows([
    ['Ustun', 'Tavsif'],
    ['unit_no', 'Majburiy. Korpus ichidagi xonadon raqami. Takrorlanmas bo‘lishi kerak.'],
    ['floor', 'Ixtiyoriy. 0 dan 250 gacha butun son.'],
    ['rooms', 'Ixtiyoriy. 0.5 dan 20 gacha, masalan 1, 1.5, 2, 3.'],
    ['area_m2', 'Ixtiyoriy. Kvadrat metrda, 0 dan katta va 10 000 dan oshmasin.'],
    ['price', 'Ixtiyoriy. Manfiy bo‘lmagan son.'],
    ['currency', 'USD, UZS yoki EUR. Bo‘sh qoldirilsa USD ishlatiladi.'],
    ['plan_url', 'Ixtiyoriy. Xonadon rejasining https:// bilan boshlanuvchi URL manzili.'],
    ['Eslatma', 'Faqat bir korpus uchun import qilinadi. Bir faylda ko‘pi bilan 500 ta xonadon.'],
    ['Eslatma', 'Formula ishlatmang. Faqat qiymatlarni kiriting. Birinchi varaq nomi va ustun sarlavhalarini o‘zgartirmang.'],
  ])
  guide.getRow(1).font = { bold: true }
  guide.getRow(1).height = 24

  const buffer = await workbook.xlsx.writeBuffer()
  return new Response(buffer as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="royalhouse-xonadon-import.xlsx"',
      'Cache-Control': 'no-store',
    },
  })
}
