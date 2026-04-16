const fs = require('fs');
const path = require('path');

const controllersDir = path.join(__dirname, 'controllers');
const controllers = fs.readdirSync(controllersDir).filter(f => f.endsWith('.js'));



controllers.forEach(file => {
  const filePath = path.join(controllersDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  
  if (!content.includes("const logger = require('../utils/logger')")) {
    const requireIndex = content.indexOf("const");
    if (requireIndex !== -1) {
      const lines = content.split('\n');
      let insertIndex = 0;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('require(')) {
          insertIndex = i + 1;
        } else if (insertIndex > 0 && !lines[i].trim().startsWith('const') && !lines[i].trim().startsWith('//')) {
          break;
        }
      }
      lines.splice(insertIndex, 0, "const logger = require('../utils/logger');");
      content = lines.join('\n');
    }
  }
  
  const asyncFunctionRegex = /^(const|exports\.)(\w+)\s*=\s*async\s*\((req,\s*res)\)\s*=>\s*\{/gm;
  let match;
  const functions = [];
  
  while ((match = asyncFunctionRegex.exec(content)) !== null) {
    functions.push({ name: match[2], index: match.index });
  }
  
  functions.forEach(func => {
    const funcStart = content.indexOf(`${func.name} = async (req, res) => {`);
    if (funcStart === -1) return;
    
    const tryIndex = content.indexOf('try {', funcStart);
    const catchIndex = content.indexOf('} catch (error) {', funcStart);
    
    if (tryIndex !== -1 && catchIndex !== -1) {
      const afterTry = tryIndex + 'try {'.length;
      const loggerCall = `\n    logger.info('${func.name}', { userId: req.user?.id });`;
      
      if (!content.substring(afterTry, afterTry + 200).includes('logger.info')) {
        content = content.substring(0, afterTry) + loggerCall + content.substring(afterTry);
      }
      
      const newCatchIndex = content.indexOf('} catch (error) {', funcStart);
      const catchBlock = content.substring(newCatchIndex, newCatchIndex + 300);
      
      if (!catchBlock.includes('logger.error')) {
        const resIndex = content.indexOf('res.status', newCatchIndex);
        if (resIndex !== -1 && resIndex < newCatchIndex + 300) {
          const loggerError = `    logger.error('${func.name} error', { error: error.message, stack: error.stack, userId: req.user?.id });\n`;
          content = content.substring(0, newCatchIndex + '} catch (error) {'.length) + '\n' + loggerError + content.substring(newCatchIndex + '} catch (error) {'.length);
        }
      }
    }
  });
  
  fs.writeFileSync(filePath, content, 'utf8');
  
});


