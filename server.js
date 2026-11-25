//express 사용 문법
const express = require('express')
const app = express()

//env 파일 사용
require('dotenv').config();

//해싱용 bcyrpy
const bcrypt = require('bcrypt')

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


//passport 라이브러리
const session = require('express-session')
const passport = require('passport')
const LocalStrategy = require('passport-local')

app.use(passport.initialize())
app.use(session({
  //session을 암호화해서 저장할 때 쓰는 비밀번호
  secret: process.env.session_secret,
  resave : false,
  saveUninitialized : false,
  cookie : { maxAge : 60 * 60 * 1000 }
}))

app.use(passport.session()) 

passport.use(new LocalStrategy({ usernameField: 'email' },  (입력한아이디, 입력한비번, cb) => {
  connection.query('SELECT * FROM users WHERE email = ?', [입력한아이디], async function(err, results, fields) {
    if (err) {
      console.error('쿼리 실행 실패: ' + err.stack);
      return cb(err)
    }
    if (results.length === 0) {
      return cb(null, false, { message: '이메일 또는 비밀번호가 일치하지 않습니다.' });
    }

    const user = results[0];
    if (await bcrypt.compare(입력한비번, user.password_hash) === false) {
      return cb(null, false, { message: '이메일 또는 비밀번호가 일치하지 않습니다.' });
    }
    return cb(null, { id: user.id, nickname: user.nickname, email: user.email });
  })
}))


//로그인 성공 시 세션 생성후 유저에게 전달
passport.serializeUser((user, done) => {
  process.nextTick(() => {
    done(null, { id: user.id })
  })
})

//유저가 서버에 요청할때마다 쿠키 까보고 로그인 여부 판단
passport.deserializeUser((user, done) => {
  connection.query('SELECT id, nickname, email FROM users WHERE id = ?', [user.id], function(err, results, fields) {
    if (err) {
      console.error('쿼리 실행 실패: ' + err.stack);
      return done(err)
    }
  process.nextTick(() => {
    return done(null, results[0] || false)
  })
})
})


app.listen(8080, () => {
    console.log('http://localhost:8080 에서 서버 실행중')
})

app.get('/', (요청, 응답) => {
  응답.sendFile(__dirname + '/index.html')
})

app.get('/news', (요청, 응답) => {
  응답.send('뉴스 화면')
})

// app.get('/list', (요청, 응답) => {
//   connection.query('SELECT * FROM users', function(err, results, fields) {
//     if (err) {
//       console.error('쿼리 실행 실패: ' + err.stack);
//     }
//     응답.render('list.ejs', { 글목록: results });
//   });
// });

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

//페이지네이션 만들기
// 각 페이지 아래에 이동버튼을 만듬
//버튼 1 누르면 1~5번째 글 보여주고
//버튼 2 누르면 6~10번째 글 보여주고하면 될듯?

app.get('/list/:id', (요청, 응답) => {
  const limit = 5;
  const page = Number(요청.params.id);
  if (!Number.isSafeInteger(page) || page < 1) {
    return 응답.redirect('/list/1');
  }

  connection.query('SELECT COUNT(*) AS total FROM users', function(err, countResults) {
    if (err) {
      console.error('개수 조회 실패: ' + err.stack);
      return 응답.status(500).send('개수 조회 실패');
    }

    const totalPages = Math.ceil(countResults[0].total / limit);
    if (page > Math.max(1, totalPages)) {
      return 응답.redirect('/list/' + Math.max(1, totalPages));
    }

    const offset = (page - 1) * limit;
    const startPage = Math.floor((page - 1) / 5) * 5 + 1;
    const endPage = Math.min(startPage + 4, totalPages);

    connection.query('SELECT * FROM users ORDER BY id ASC LIMIT ? OFFSET ?', [limit, offset], function(err, results, fields) {
      if (err) {
        console.error('쿼리 실행 실패: ' + err.stack);
        return 응답.status(500).send('조회 실패');
      }
      응답.render('list.ejs', {글목록: results, page, startPage, endPage, totalPages });
    });
  });
});




app.get('/join', (요청, 응답) => {
  응답.render('join.ejs')
})

app.post('/join', async (요청, 응답) => {
  const { nickname, email, password } = 요청.body;
  let hash = await bcrypt.hash(password, 10);
  connection.query('INSERT INTO users (nickname, email, password_hash) VALUES (?, ?, ?)',
    [nickname, email, hash], function(err, results, fields) {
    if (err) {
      console.error('데이터 삽입 실패: ' + err.stack);
      응답.status(500).send('데이터 삽입 실패');
      return;
    }
    else {
      응답.redirect('/');
    }
})
})

app.get('/login', (요청, 응답) => {
  응답.render('login.ejs')
})

app.post('/login', (요청, 응답, next) => {
  // 요청.body가 db에 있는거랑 일치하는지 확인하고 세션 생성
  passport.authenticate('local', (error, user, info) => {
      if (error) return 응답.status(500).json(error)
      if (!user) return 응답.status(401).json(info.message)
      요청.logIn(user, (err) => {
        if (err) return next(err)
        응답.redirect('/')
      })
  })(요청, 응답, next)
})

app.get('/mypage', (요청, 응답) => {
  if (!요청.isAuthenticated()) {
    return 응답.redirect('/login');
  }
  응답.render('mypage.ejs', { user: 요청.user });
})
