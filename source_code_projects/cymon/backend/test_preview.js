const fs = require('fs');
const path = require('path');

try {
  let code = fs.readFileSync(path.join(__dirname, 'lib/email.js'), 'utf8');
  // Hack to export the internal renderFallback function
  code += '\nmodule.exports.renderFallback = renderFallback;\n';
  
  const m = new module.constructor();
  m.paths = module.paths;
  m._compile(code, path.join(__dirname, 'lib/email.js'));
  
  const { renderFallback } = m.exports;
  
  const { html } = renderFallback('welcome', { 
    parent_name: 'Jane Doe', 
    child_name: 'John Doe', 
    parent_email: 'jane@example.com', 
    temporary_password: 'SecurePassword123!' 
  });
  
  const outPath = path.join(__dirname, 'preview.html');
  fs.writeFileSync(outPath, html);
  console.log('Preview saved to:', outPath);
} catch (err) {
  console.error(err);
}
