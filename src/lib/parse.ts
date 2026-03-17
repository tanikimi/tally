import * as XLSX from 'xlsx'

export type GradeRecord = {
    科目名: string
    単位数: number
    区分: string
    合否: string
}

export type Requirement = {
    区分: string
    小区分: string
    科目名: string
    単位数: number
}

export type MatchedRequirement = {
    区分: string
    小区分: string
    科目名: string
    単位数: number
    取得済み: boolean
    その他: boolean
}

export type SummaryGroup = {
    区分: string
    小区分: string
    科目一覧: MatchedRequirement[]
    合計単位数: number
}

export function normalize(name: string): string {
    return name
        .replace(/◆/g, '')
        .replace(/（[^）]*）/g, '')
        .replace(/\([^)]*\)/g, '')
        .replace(/[①-⑳㉑-㉟㊱-㊿]/g, '')
        .replace(/[Ａ-Ｚａ-ｚ０-９]/g, c =>
            String.fromCharCode(c.charCodeAt(0) - 0xFEE0)
        )
        .replace(/\s/g, '')
}

function removeParenFromCategory(name: string): string {
    return name
        .replace(/【([^】]*)】/g, '$1')
        .replace(/《([^》]*)》/g, '$1')
        .replace(/〈([^〉]*)〉/g, '$1')
        .trim()
}

export function parseCsv(file: File): Promise<GradeRecord[]> {
    return new Promise((resolve) => {
        const reader = new FileReader()
        reader.onload = (e) => {
            const buffer = e.target!.result as ArrayBuffer
            const decoder = new TextDecoder('shift-jis')
            const text = decoder.decode(buffer)

            const wb = XLSX.read(text, { type: 'string' })
            const ws = wb.Sheets[wb.SheetNames[0]]
            const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 })

            const headerIdx = rows.findIndex(row => row[0] === '科目名')
            const dataRows = rows.slice(headerIdx + 1)

            const records: GradeRecord[] = []
            let currentCategory = ''

            for (const row of dataRows) {
                const name = String(row[0] ?? '').trim()
                if (!name) continue

                if (name.startsWith('【') || name.startsWith('《') || name.startsWith('〈')) {
                    currentCategory = removeParenFromCategory(name)
                    continue
                }

                const credits = String(row[1] ?? '').trim()
                const score = String(row[2] ?? '').trim()
                const gp = String(row[3] ?? '').trim()
                const gpProduct = String(row[4] ?? '').trim()
                const year = String(row[5] ?? '').trim()
                const teacher = String(row[6] ?? '').trim()

                // 認定科目は列が埋まっていなくてもOK
                const isNintei = credits === '認' || score === '認'
                if (!isNintei && (!credits || !score || !gp || !gpProduct || !year || !teacher)) continue

                const passed = isNintei || credits !== '*'

                records.push({
                    科目名: normalize(name),
                    単位数: credits === '認' || credits === '*' ? 0 : Number(credits),
                    区分: currentCategory,
                    合否: passed ? '合' : '否',
                })
            }

            // 同じ科目名が複数ある場合、一度でも合格していれば合格扱い
            const merged = new Map<string, GradeRecord>()
            for (const record of records) {
                const existing = merged.get(record.科目名)
                if (!existing || record.合否 === '合') {
                    merged.set(record.科目名, record)
                }
            }

            resolve(Array.from(merged.values()))
        }
        reader.readAsArrayBuffer(file)
    })
}

export function parseXlsx(file: File): Promise<Requirement[]> {
    return new Promise((resolve) => {
        const reader = new FileReader()
        reader.onload = (e) => {
            const data = new Uint8Array(e.target!.result as ArrayBuffer)
            const wb = XLSX.read(data, { type: 'array' })
            const ws = wb.Sheets[wb.SheetNames[0]]
            const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 })

            const leftRequirements: Requirement[] = []
            const rightRequirements: Requirement[] = []
            let currentCategoryL = ''
            let currentSubCategoryL = ''
            let currentCategoryR = ''
            let currentSubCategoryR = ''

            for (const row of rows) {
                // 左側
                const categoryL = row[0] ? normalize(String(row[0]).trim()) : null
                const subCategoryL = row[2] ? normalize(String(row[2]).trim()) : null
                const subjectNameL = row[4] ? String(row[4]).trim() : null
                const creditsL = row[11]

                if (categoryL) currentCategoryL = categoryL
                if (subCategoryL) currentSubCategoryL = subCategoryL

                if (subjectNameL && typeof creditsL === 'number') {
                    const normalizedName = normalize(subjectNameL)
                    const isDuplicate = leftRequirements.some(r => normalize(r.科目名) === normalizedName)
                    if (!isDuplicate) {
                        leftRequirements.push({
                            区分: currentCategoryL,
                            小区分: currentSubCategoryL,
                            科目名: normalizedName,
                            単位数: creditsL,
                        })
                    }
                }

                // 右側
                const categoryR = row[25] ? normalize(String(row[25]).trim()) : null
                const subCategoryR = row[27] ? normalize(String(row[27]).trim()) : null
                const subjectNameR = row[28] ? String(row[28]).trim() : null
                const creditsR = row[35]

                if (categoryR) currentCategoryR = categoryR
                if (subCategoryR) currentSubCategoryR = subCategoryR

                if (subjectNameR && typeof creditsR === 'number') {
                    const normalizedName = normalize(subjectNameR)
                    const isDuplicate = rightRequirements.some(r => normalize(r.科目名) === normalizedName)
                    if (!isDuplicate) {
                        rightRequirements.push({
                            区分: currentCategoryR,
                            小区分: currentSubCategoryR,
                            科目名: normalizedName,
                            単位数: creditsR,
                        })
                    }
                }
            }

            // 左を先に、右を後に結合（重複除去）
            const all = [...leftRequirements]
            for (const r of rightRequirements) {
                const isDuplicate = all.some(l => normalize(l.科目名) === normalize(r.科目名))
                if (!isDuplicate) all.push(r)
            }

            resolve(all)
        }
        reader.readAsArrayBuffer(file)
    })
}

export function match(
    requirements: Requirement[],
    grades: GradeRecord[]
): MatchedRequirement[] {
    const passedGrades = grades.filter(g => g.合否 === '合')
    const passedNames = new Set(passedGrades.map(g => g.科目名))
    const requirementNames = new Set(requirements.map(r => r.科目名))

    // Excelの科目（必修・メジャー科目）
    const matched: MatchedRequirement[] = requirements.map(req => ({
        区分: req.区分,
        小区分: req.小区分,
        科目名: req.科目名,
        単位数: req.単位数,
        取得済み: passedNames.has(req.科目名),
        その他: false,
    }))

    // ExcelにないCSV合格科目（その他）
    for (const grade of passedGrades) {
        if (requirementNames.has(grade.科目名)) continue

        matched.push({
            区分: grade.区分,
            小区分: '',
            科目名: grade.科目名,
            単位数: grade.単位数,
            取得済み: true,
            その他: true,
        })
    }

    return matched
}

export function summarize(matched: MatchedRequirement[]): SummaryGroup[] {
    const passed = matched.filter(r => r.取得済み)
    const groups = new Map<string, SummaryGroup>()

    for (const r of passed) {
        const key = r.小区分 ? `${r.区分}___${r.小区分}` : r.区分
        if (!groups.has(key)) {
            groups.set(key, {
                区分: r.区分,
                小区分: r.小区分,
                科目一覧: [],
                合計単位数: 0,
            })
        }
        const group = groups.get(key)!
        group.科目一覧.push(r)
        group.合計単位数 += r.単位数
    }

    return Array.from(groups.values())
}