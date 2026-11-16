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
app.use(express.json());
app.use(express.urlencoded({extended:true})) 

//ejs 셋팅
app.set('view engine', 'ejs') 





app.listen(8080, () => {
    console.log('http://localhost:8080 에서 서버 실행중')
})

app.get('/', (요청, 응답) => {
  응답.sendFile(__dirname + '/index.html')
})

app.get('/news', (요청, 응답) => {
  응답.send('뉴스 화면')
})

app.get('/list', (요청, 응답) => {
  connection.query('SELECT * FROM users', function(err, results, fields) {
    if (err) {
      console.error('쿼리 실행 실패: ' + err.stack);
    }
    응답.render('list.ejs', { 글목록: results });
  });
});

app.get('/add', (요청, 응답) => {
  응답.render('view.ejs')
})

app.get('/detail/:id', (요청, 응답) => {
  try {
    connection.query('SELECT * FROM users WHERE id = ?', [요청.params.id], function(err, results, fields) {
    if (err) {
      console.error('쿼리 실행 실패: ' + err.stack);
    }
    console.log(results)
    응답.render('detail.ejs', { result : results });
  });
  }
  catch (error) {
    console.error('쿼리 실행 실패: ' + error.stack);
  }
});

app.post('/api', (요청, 응답) => {
  let data = 요청.body.data
});

app.post('/add', (요청, 응답) => {
  console.log(요청.body)
  connection.query('INSERT INTO users (nickname, email, password_hash) VALUES (?, ?, ?)', 
    [요청.body.nickname, 요청.body.email, 요청.body.password], function(err, results, fields) {
    if (err) {
      console.error('데이터 삽입 실패: ' + err.stack);
      응답.status(500).send('데이터 삽입 실패');
      return;
    }
    응답.redirect('/add');
  });
});

// 수정기능
// 1. 수정버튼 누르면 수정할 수 있는 창으로 이동
//  list에 a href로 수정버튼 구현 후, 링크를 edit/:id로 이동하게끔 구현 

// 2. 그 페이지에는 글의 제목이랑 내용이 폼에 채워져있어야함
//  이동하면 input 두개에 db에서 데이터 가져와서 value에 넣어주기
app.get('/edit/:id', (요청, 응답) => {
  connection.query('SELECT * FROM users WHERE id = ?', [요청.params.id], function(err, results, fields) {
    if (err) {
      console.error('쿼리 실행 실패: ' + err.stack);
    }
    응답.render('edit.ejs', { result : results });
  });
})
// 3. 수정완료버튼 누르면 기존 db 내용 수정
//  db에서 update 쿼리문 사용해서 수정

app.post('/edit', (요청, 응답) => {
  console.log(요청.body)
  connection.query('UPDATE users SET nickname = ?, email = ? WHERE id = ?',
    [요청.body.nickname, 요청.body.email, 요청.body.id], function(err, results, fields) {
    if (err) {
      console.error('데이터 업데이트 실패: ' + err.stack);
      응답.status(500).send('데이터 업데이트 실패');
      return;
    }
    응답.redirect('/list');
  });
});


// 버튼 누르면 
// 서버로 요청 보내서
// 서버에서 확인 후에 DB에 삭제 쿼리문 날려서 삭제
app.delete('/delete', (요청, 응답) => {
  connection.query('DELETE FROM users WHERE id = ?', [요청.query.docid], function(err, results, fields) {
    if (err) {
      console.error('데이터 삭제 실패: ' + err.stack);
      응답.status(500).send('데이터 삭제 실패');
      return;
    }
    else{
      console.log('삭제 성공');
    }
    응답.redirect('/list');
  });
});
