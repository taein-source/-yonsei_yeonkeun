import fs from 'fs';

const files = ['./.data/users.json', './.data/chats.json', './.data/user_data.json'];
files.forEach(file => {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    const updated = content.replace(/data:image\/svg\+xml;utf8,[^"'\`]+/g, '/avatars/yeongeun_stand.png');
    fs.writeFileSync(file, updated, 'utf8');
    console.log(`Cleaned ${file}`);
  }
});
