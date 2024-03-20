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

            return {...prev, ...data}
        },{});

        return convertToJsonString(JSON.stringify(headerObject))
    }
}

function responseGenerator(response) {
    if(!response || response.length == 0) {
        return ``;
    }

    let successResponse = response.find(it => it.status == 'OK')

    if(successResponse){
        return `
\`\`\`${successResponse?._postman_previewlanguage} {% title="Response Body" %}
${successResponse?.body}
\`\`\`
`
    }else{
        return `
\`\`\`${response[0]?._postman_previewlanguage} {% title="Response Body" %}
${response[0]?.body}
\`\`\`
`
    }
}

function getContentData(data, type){
    if(type == 'json'){
        return convertToJsonString(JSON.stringify(JSON.parse(data)))
    }else{
        return data
    }
}

function makeMarkdownContent(item) {
    let txt = `## ${item.name}

{% codesblock %}
{% apicalling 
    method="${item.request?.method.toLowerCase()}" 
    endpoint="${item.request?.url?.path.join('/')}"
    headers="${makeHeader(item.request?.header)}"
    data="${getContentData(item.request?.body?.raw, item.request?.body?.options?.raw?.language)}"
/%}

${responseGenerator(item.response)}
{% /codesblock %}

{% content %}
${item.request?.description}
{% /content %}
`
    return txt;
}

let data = fs.readFileSync(jsonDocPath, 'utf8');
let postmanJsonData = JSON.parse(data);

let infoName = postmanJsonData.info.name.toLowerCase();
let projectName = infoName.split(" ").join('-');

// go to previous dir
baseDir.pop();
process.chdir(baseDir.join('/'));

// Create Next.js project with markdoc
// execSync(`npx create-next-app@latest ${projectName} --ts --example "https://github.com/ayand269/api-structure-example"`);

// go to new project dir
baseDir.push(projectName);
process.chdir(baseDir.join('/'));

let allItems = postmanJsonData.item;

for (const iterator of allItems) {
    let folderName = iterator.name.toLowerCase();
    for (const element of iterator.item) {
        let apiName = element.name;
        let apiFileName = `${apiName.split(' ').join('-').toLowerCase()}.md`
        let filePath = `pages/docs/${folderName}/${apiFileName}`
        fs.ensureFileSync(filePath)
        let markdownContent = makeMarkdownContent(element)
        fs.writeFileSync(filePath, markdownContent, 'utf8')
    }
}