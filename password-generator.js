'use strict';
const length = 12;
const charset = 'abcdefghijklmnopqrstuvwxyz' + 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' + '0123456789';
  
function passwordGenerator() {
  let password = '';
  for (let i = 0; i < length; i++) {
    password += charset[Math.floor(Math.random() * charset.length)];
  }
  // 真偽値が入る
  const includeAllTypes = /[a-z]/.test(password) && /[A-Z]/.test(password) && /[0-9]/.test(password);
  // {真偽値} ? {真の時の値} : {偽の時の値}
  return includeAllTypes ? password : passwordGenerator();
}
  
console.log(passwordGenerator());  
  


