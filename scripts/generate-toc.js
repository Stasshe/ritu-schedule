#!/usr/bin/env node
const fs = require('fs').promises;
const path = require('path');

const DATA_DIR = path.resolve(process.cwd(), 'data');

async function exists(p){ try{ await fs.access(p); return true }catch(e){return false} }
function toPosix(p){ return p.split(path.sep).join('/') }
function isMarkdown(name){ return /\.md$/i.test(name) }

async function getAllDirs(root){
  const list = [];
  async function walk(dir){
    list.push(dir);
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for(const e of entries){ if(e.isDirectory()){ await walk(path.join(dir, e.name)) } }
  }
  await walk(root);
  return list;
}

async function writeReadme(dir){
  const entries = await fs.readdir(dir, { withFileTypes: true });
  entries.sort((a,b)=> a.name.localeCompare(b.name, 'ja'));
  const lines = ['# 目次', ''];
  for(const e of entries){
    if(e.name.startsWith('.')) continue;
    if(e.isDirectory()){
      const link = './' + encodeURI(e.name) + '/';
      lines.push(`- [${e.name}](${link})`);
    } else if(e.isFile() && isMarkdown(e.name)){
      if(e.name.toLowerCase() === 'readme.md') continue;
      const display = e.name.replace(/\.md$/i, '');
      const link = './' + encodeURI(e.name);
      lines.push(`- [${display}](${link})`);
    }
  }
  lines.push('');
  await fs.writeFile(path.join(dir, 'README.md'), lines.join('\n'), 'utf8');
}

async function buildBreadcrumb(filePath){
  const rel = path.relative(DATA_DIR, filePath);
  const segments = rel.split(path.sep).filter(Boolean);
  const fileDir = path.dirname(filePath);
  const crumbs = [];
  for(let i=0;i<segments.length;i++){
    const isLast = i === segments.length - 1;
    const seg = segments[i];
    const target = isLast ? path.join(DATA_DIR, ...segments.slice(0, i+1)) : path.join(DATA_DIR, ...segments.slice(0, i+1));
    let relToTarget = path.relative(fileDir, target);
    relToTarget = toPosix(relToTarget);
    if(relToTarget === '') relToTarget = './';
    if(!isLast && !relToTarget.endsWith('/')) relToTarget += '/';
    relToTarget = encodeURI(relToTarget);
    const display = isLast ? seg.replace(/\.md$/i, '') : seg;
    crumbs.push(`[${display}](${relToTarget})`);
  }
  return crumbs.join(' > ');
}

async function insertBreadcrumbs(filePath){
  const raw = await fs.readFile(filePath, 'utf8');
  const cleaned = raw.replace(/<!-- BREADCRUMB:START -->[\s\S]*?<!-- BREADCRUMB:END -->\n*/g, '');
  const breadcrumb = await buildBreadcrumb(filePath);
  const top = `<!-- BREADCRUMB:START -->\n${breadcrumb}\n<!-- BREADCRUMB:END -->\n\n`;
  let out = cleaned;
  const fm = out.match(/^---\n[\s\S]*?\n---\n/);
  if(fm){ out = out.replace(fm[0], fm[0] + top); } else { out = top + out }
  const bottom = `\n<!-- BREADCRUMB:START -->\n${breadcrumb}\n<!-- BREADCRUMB:END -->\n`;
  out = out.replace(/\n+$/, '\n');
  out = out + bottom;
  await fs.writeFile(filePath, out, 'utf8');
}

async function main(){
  if(!await exists(DATA_DIR)){
    console.error('No data/ directory found — nothing to do.');
    process.exit(0);
  }
  const dirs = await getAllDirs(DATA_DIR);
  for(const dir of dirs){
    await writeReadme(dir);
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for(const e of entries){
      if(e.isFile() && isMarkdown(e.name) && e.name.toLowerCase() !== 'readme.md'){
        const fp = path.join(dir, e.name);
        await insertBreadcrumbs(fp);
      }
    }
  }
  console.log('Generated README.md for each directory and inserted breadcrumbs.');
}

main().catch(err=>{ console.error(err); process.exit(1) });
