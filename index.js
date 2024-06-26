const fs = require('fs-extra');
const { execSync } = require('child_process');
const minimist = require('minimist');

let baseDir = __dirname.split('/')

// Parse command-line arguments using minimist
const argv = minimist(process.argv.slice(2));

const jsonDocPath = argv._[0];

if (!jsonDocPath) {
    console.error('Please provide the postman collection json');
    process.exit(1);
}

function addLineToAFile(filePath, replaceBy, replaceWith) {
    let data = fs.readFileSync(filePath, 'utf8')

    const updatedContent = data.replace(replaceBy, replaceWith)
    fs.writeFileSync(filePath, updatedContent, 'utf8')
}

function convertToJsonString(txt) {
    const escapedString = txt.replace(/"/g, '\\"');

    return escapedString
}

function makeHeader(allHeaders) {
    if (!allHeaders || allHeaders.length == 0) {
        return JSON.stringify({})
    } else {
        let headerObject = allHeaders.reduce((prev, current) => {
            let data = {};
            data[current.key] = current.value

            return { ...prev, ...data }
        }, {});

        return convertToJsonString(JSON.stringify(headerObject))
    }
}

function responseGenerator(response) {
    if (!response || response.length == 0) {
        return ``;
    }

    let successResponse = response.find(it => it.status == 'OK')

    if (successResponse) {
        return `
\`\`\`${successResponse?._postman_previewlanguage} {% title="Response Body" %}
${successResponse?.body}
\`\`\`
`
    } else {
        return `
\`\`\`${response[0]?._postman_previewlanguage} {% title="Response Body" %}
${response[0]?.body}
\`\`\`
`
    }
}

function getContentData(data, type) {
    if (type == 'json') {
        return convertToJsonString(JSON.stringify(JSON.parse(data)))
    } else {
        return data
    }
}

function makeBaseUrlFromVariables(mainUrl, variables) {
    if (!mainUrl) return ''
    if (!variables) return mainUrl;

    let url = mainUrl?.raw
    mainUrl.host.map((item) => {
        let regex = /{{(.*?)}}/;
        let baseUrlMatch = regex.exec(item);
        let matchedVariable = variables.find(it => it.key == baseUrlMatch[1])
        url = url.replace(item, matchedVariable.value)
        url = url.replace(mainUrl?.path.join('/'), '')
    })
    return url
}

function makeMarkdownContent(item, variables) {
    let txt = `## ${item.name}
{% docscontent %}
{% codesblock %}
{% apicalling 
    method="${item.request?.method.toLowerCase()}" 
    endpoint="${item.request?.url?.path.join('/')}"
    headers="${makeHeader(item.request?.header)}"
    data="${getContentData(item.request?.body?.raw, item.request?.body?.options?.raw?.language)}"
    baseurl="${makeBaseUrlFromVariables(item.request?.url, variables)}"
/%}

${responseGenerator(item.response)}
{% /codesblock %}

{% content %}
${item.request?.description}
{% /content %}
{% /docscontent %}
`
    return txt;
}

function makeMarkdownFileAndSidebar(allItems, parentFolderName, href) {
    let hrefArr = [];
    for (const iterator of allItems) {

        if (Array.isArray(iterator.item)) {
            let folderName = iterator.name.split(' ').join('-').toLowerCase();
            let childFolderName = parentFolderName ? `${parentFolderName}/${folderName}` : folderName
            let indexFile = `pages/docs/${childFolderName}/index.md`
            fs.ensureFileSync(indexFile)
            let content = `{% content %}
${iterator.description}
{% /content %}`

            fs.writeFileSync(indexFile, content, 'utf8')

            let sidebarData = {
                title: iterator.name,
                href: `/docs/${childFolderName}`,
                expanded: true,
                children: []
            }

            let parentHref = makeMarkdownFileAndSidebar(iterator.item, childFolderName, sidebarData.href)
            sidebarData.children = parentHref
            hrefArr.push(sidebarData)
        } else {
            let apiName = iterator.name;
            let apiFileName = `${apiName.split(' ').join('-').toLowerCase()}`;
            let filePath = `pages/docs/${parentFolderName}/${apiFileName}.md`;
            fs.ensureFileSync(filePath)

            let markdownContent = makeMarkdownContent(iterator, postmanJsonData.variable)
            fs.writeFileSync(filePath, markdownContent, 'utf8')

            let sidebarChildData = {
                title: apiName,
                href: href ? `${href}/${apiFileName}` : `docs/${apiFileName}`
            }
            hrefArr.push(sidebarChildData)
        }

    }

    return hrefArr
}

let data = fs.readFileSync(jsonDocPath, 'utf8');
let postmanJsonData = JSON.parse(data);

let infoName = postmanJsonData.info.name.toLowerCase();
let projectName = infoName.split(" ").join('-');

// go to previous dir
baseDir.pop();
process.chdir(baseDir.join('/'));

// Create Next.js project with markdoc
execSync(`npx create-next-app@latest ${projectName} --ts --example "https://github.com/ayand269/api-structure-example"`);
const projectDir = process.cwd() + '/' + projectName;
// go to new project dir
baseDir.push(projectName);
process.chdir(baseDir.join('/'));



let allItems = postmanJsonData.item;
let sidebarElement = [
    {
        title: 'Introduction',
        href: '/'
    }
]

sidebarElement.push(...makeMarkdownFileAndSidebar(allItems))

// for (const iterator of allItems) {
//     let folderName = iterator.name.split(' ').join('-').toLowerCase();
//     let indexFile = `pages/docs/${folderName}/index.md`
//     fs.ensureFileSync(indexFile)
//     let content = `{% content %}
// ${iterator.description}
// {% /content %}`
//     fs.writeFileSync(indexFile, content, 'utf8')
//     let sidebarData = {
//         title: iterator.name,
//         href: `/docs/${iterator.name.split(' ').join('-').toLowerCase()}`,
//         expanded: false,
//         children: iterator.item?.length > 0 ? [] : undefined
//     }

//     for (const element of iterator.item) {
//         let apiName = element.name;
//         let apiFileName = `${apiName.split(' ').join('-').toLowerCase()}`
//         let filePath = `pages/docs/${folderName}/${apiFileName}.md`
//         fs.ensureFileSync(filePath)
//         let markdownContent = makeMarkdownContent(element, postmanJsonData.variable)
//         fs.writeFileSync(filePath, markdownContent, 'utf8')

//         let sidebarChildData = {
//             title: apiName,
//             href: `${sidebarData.href}/${apiFileName}`
//         }
//         sidebarData.children.push(sidebarChildData)
//     }
//     sidebarElement.push(sidebarData)
// }

addLineToAFile(`${projectDir}/components/SideNav.tsx`,
    'const [items, setItems] = useState<Array<SidebarItem>>([])',
    `const [items, setItems] = useState<Array<SidebarItem>>(${JSON.stringify(sidebarElement)})`
)