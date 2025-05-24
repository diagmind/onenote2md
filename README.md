# Under-Construction

![](https://raw.githubusercontent.com/ugurcandede/Under-Construction/refs/heads/master/construction-scene/Capture.PNG)

# ONENOTE2MD

開發目標:

onenote->docx->html->dom tree->md

A versatile tool for converting DOCX files to HTML with configurable options.

## Installation

### Global Installation

```bash
npm install -g docx2html
```

### Local Installation

```bash
npm install docx2html
```

## Usage

### Command Line Options

```
Options:
  -V, --version               output the version number
  -u, --url <url>             base URL to download docx file from (e.g., https://diagmindtw.com/rawdocx/)
  -b, --configUrl <url>       URL to config file
  -s, --source <type>         Source type: "local" or "remote"
  -o, --output <path>         Output directory path (default:./output)
  -w, --dev                   Start server at http://127.0.0.1:48489 to view the HTML output
  -e, --debug                 Enable debug mode to log each processing stage
  -m, --markdown              Download markdown files from generated HTML pages (requires --dev)
  -p, --port <number>         Port for the dev server (default: 48489)
  -t, --wait <ms>             Wait time in milliseconds for markdown download process (default: 5000)
  -M, --autoMd                Combination of -s local -m --dev with auto-stop server when all markdown files are downloaded
  -h, --help                  display help for command
```


使用-u配合-b會自動在-u的超連結後面加上-b的檔名陣列；

### The `-M` Parameter

The `-M` or `--autoMd` parameter provides a convenient way to:
1. Process files locally (`-s local`)
2. Start a development server (`--dev`)
3. Download all markdown files (`-m`)
4. Automatically stop the server when all markdown files have been downloaded

This is especially useful for batch processing where you want to convert docx files to markdown and have the process terminate automatically once complete.

### Examples

```bash
# Convert remote DOCX files
docx2html -u "https://diagmindtw.com/rawdocx/serve-docx.php?file=" -b "https://diagmindtw.com/kcms0.php#edit" -s remote

# Convert local DOCX files with development server (還沒測試)
docx2html -b "./config.json" -s local -o "./html-output" -w

# Enable debug mode
docx2html -b "./config.json" -s local -e

# Download markdown files automatically with auto-stop when complete
docx2html -b "./config.json" -o "./html-output" -M
```

## Configuration File

You can use a JSON configuration file to specify multiple settings. Here's an example:

[
    {
        "text": "輸入",
        "items": [
            {
                "text": "內科",
                "link": "內科.docx"
            },
            {
                "text": "外科",
                "link": "外科.docx"
            },
            {
                "text": "婦產科",
                "link": "婦產科.docx"
            },
            {
                "text": "兒科",
                "link": "兒科.docx"
            },
            {
                "text": "其他",
                "link": "其他.docx"
            }
        ]
    },
    {
        "text": "輸出",
        "items": [
            {
                "text": "內科",
                "link": "/InternalMedicineDepartment",
"display": "none"
            },
            {
                "text": "外科",
                "link": "/SurgicalDepartment",
                "display": "none"
            },
            {
                "text": "婦產科",
                "link": "/ObstetricsGynecologyDepartment",
                "display": "none"
            },
            {
                "text": "兒科",
                "link": "/ChildDepartment",
                "display": "none"
            },
            {
                "text": "其他",
                "link": "/Appointments",
                "display": "none"
            },
            {
                "text": "外科",
                "link": "/SurgicalDepartment"
            },
            {
                "text": "婦產科",
                "link": "/ObstetricsGynecologyDepartment"
            },
            {
                "text": "兒科",
                "link": "/ChildDepartment"
            },
            {
                "text": "其他",
                "link": "/Appointments"
            }
        ]
    }
]


## 開發人員專區

### 程式邏輯(每一個階段的成果可以藉由-e參數log出debug)

1. 讀取config.json檔案
2. 取得預計下載的docx網址陣列
3. 下載docx檔案
4. 複製 master HTML 模板到輸出資料夾，改名成config的"輸出"那個陣列(link)，裡面有多少元素就要複製幾次
5. 執行以下邏輯(修改html)
   - 替換 DOCX 文件的引用路徑
   - 替換資源路徑 (public 目錄)
6. 其中目標url如果設定是remote的話，會自動在網址後面加上config的"輸入"那個陣列(含有base url)，不然docx要複製一份到輸出資料夾，檔名要改成config的"輸出"那個陣列(text).docx
7. 如果有display none，給403頁面
8. -w 被設定，在本地啟動開發服務器，可以預覽生成的HTML

## Building and Publishing

### 構建項目

```bash
# 安裝依賴
npm install

# 構建項目
npm run build
```

### 發佈到 npm

```bash
# 更新版本號
npm version patch|minor|major

# 發佈到 npm
npm publish
```

## License

This project is licensed under the MIT License.