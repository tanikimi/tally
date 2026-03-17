<script lang="ts">
    import { parseCsv, parseXlsx, match, summarize } from "$lib/parse";
    import type {
        GradeRecord,
        Requirement,
        MatchedRequirement,
        SummaryGroup,
    } from "$lib/parse";

    let csvFile = $state<File | null>(null);
    let xlsxFile = $state<File | null>(null);
    let grades = $state<GradeRecord[]>([]);
    let requirements = $state<Requirement[]>([]);
    let matched = $state<MatchedRequirement[]>([]);
    let summary = $state<SummaryGroup[]>([]);

    async function onCsvChange(e: Event) {
        const input = e.target as HTMLInputElement;
        csvFile = input.files?.[0] ?? null;
        if (csvFile) grades = await parseCsv(csvFile);
        if (grades.length && requirements.length) {
            matched = match(requirements, grades);
            summary = summarize(matched);
        }
    }

    async function onXlsxChange(e: Event) {
        const input = e.target as HTMLInputElement;
        xlsxFile = input.files?.[0] ?? null;
        if (xlsxFile) requirements = await parseXlsx(xlsxFile);
        if (grades.length && requirements.length) {
            matched = match(requirements, grades);
            summary = summarize(matched);
        }
    }
</script>

<div class="main-container">
    <header>
        <h1>Tally v1.0</h1>
    </header>

    <p>
        和歌山大学システム工学部の単位取得状況が簡単に確認できるシステムです。
        <br />
        CSVファイルとエクセルファイルをアップロードすることで、取得済みの単位数を自動で計算することができます。
        <br />
        なお、処理は全てブラウザ上で行われるため、ファイルの内容が外部に送信されることはありません。
    </p>

    <div class="callout">
        <span class="callout_title">注意</span>
        <span class="callout_description">
            <ul>
                <li>
                    単位取得状況をCSVファイルから、科目の分類をエクセルファイルから取得しています。エクセルファイルにない科目の場合、教育サポートシステム上の科目分類を用いるため、不自然な分類名になる場合があります。
                </li>
                <li class="important">
                    本システムは非公式のものであり、その結果を保証するものではありません。あくまで参考としてご利用ください。
                </li>
            </ul>
        </span>
    </div>

    <nav>
        <h2>CSVファイル</h2>
        <input
            type="file"
            accept=".csv"
            id="csv_input"
            onchange={onCsvChange}
        />
        <div class="callout">
            <span class="callout_title">CSVファイルの取得方法</span>
            <span class="callout_description">
                教育サポートシステム → 成績 → 単位取得状況照会 →
                ファイルに出力する
            </span>
        </div>

        <h2>エクセルファイル</h2>
        <input
            type="file"
            accept=".xlsx"
            id="xlsx_input"
            onchange={onXlsxChange}
        />
        <div class="callout">
            <span class="callout_title">エクセルファイルの取得方法</span>
            <span class="callout_description">
                教育サポートシステム → その他 → ダウンロードセンター →
                単位確認資料
            </span>
        </div>
    </nav>

    {#each summary as group}
        <div class="table">
            <div class="table_header">
                <span>{group.区分}</span>
                {#if group.小区分}
                    <span> / {group.小区分}</span>
                {/if}
            </div>
            {#each group.科目一覧 as r}
                <div class="table_row">
                    <span>{r.科目名}</span>
                    <span>{r.単位数}</span>
                </div>
            {/each}
            <div class="table_row table_sum">
                <span>合計</span>
                <span>{group.合計単位数}</span>
            </div>
        </div>
    {/each}
    <footer>
        <span>
            ©︎ 2026
            <a href="https://kiminori.me/" target="_blank">
                Kiminori Tanigawa
            </a>
            /
            <a href="https://github.com/tanikimi" target="_blank"> GitHub </a>
        </span>
    </footer>
</div>

<style>
    * {
        /* fonts */
        font-family: "Noto Sans JP", sans-serif;

        /* colors */
        --gray: #f0f0f3;
        --orange: #f76b15;
        --white: #fff;
    }

    .main-container {
        margin: 24px;
        max-width: 600px;
        width: 100%;
    }

    h1 {
        margin: 0 0 16px 0;
    }

    nav {
        margin: 32px 0 64px 0;
    }

    .callout {
        background-color: var(--gray);
        border-radius: 8px;
        padding: 16px;
        margin: 16px 0;
    }

    .callout_title {
        display: block;
        font-weight: bold;
        margin-bottom: 8px;
    }

    .callout_description {
        display: block;
    }

    .callout ul {
        margin: 0;
        padding-left: 20px;
    }

    .callout .important {
        color: var(--orange);
        font-weight: bold;
    }

    .table {
        border: solid 1px var(--gray);
        border-radius: 8px;
        margin: 0 0 32px 0;
        width: 100%;
    }

    .table:first-child {
        margin-top: 64px;
    }

    .table_header {
        background-color: var(--gray);
        border-radius: 8px 8px 0 0;
        font-weight: bold;
        padding: 8px 16px;
    }

    .table_row {
        display: flex;
        justify-content: space-between;
        padding: 8px 16px;
    }

    .table_sum {
        color: var(--orange);
        font-weight: bold;
    }

    footer {
        text-align: center;
        margin: 64px 0 16px 0;
    }
</style>
