const fs = require('fs');
const pdf = require('pdf-parse');

let dataBuffer = fs.readFileSync('C:\\Users\\Radyn Ryu\\.gemini\\antigravity-ide\\brain\\a65046ad-5429-44eb-9d3c-518c74394039\\.user_uploaded\\media_1787067273983.pdf');

pdf(dataBuffer).then(function(data) {
    console.log(data.text.substring(0, 1000));
});
