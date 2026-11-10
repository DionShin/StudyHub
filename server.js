//express 사용 문법
const express = require('express')
const app = express()

//env 파일 사용
require('dotenv').config();


// MySQL 연결 설정
const mysql = require('mysql2');

const connection = mysql.createConnection({
host : process.env.DB_HOST,
user : process.env.DB_USER,
password : process.env.DB_PASSWORD,
database : process.env.DB_NAME
});

connection.connect(function(err) {
  if (err) {
    console.error('연결실패 :' + err.stack);
    return;
  }
  console.log('DB 연결 성공');
});




//정적 파일 제공 설정
app.use(express.static(__dirname + '/public'));







app.listen(8080, () => {
    console.log('http://localhost:8080 에서 서버 실행중')
})

app.get('/', (요청, 응답) => {
  응답.sendFile(__dirname + '/index.html')
})

app.get('/news', (요청, 응답) => {
  응답.send('뉴스 화면')
})

