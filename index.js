const express = require('express')
const {check, validationResult} = require('express-validator')
const bcrypt = require('bcryptjs')
const flash = require('express-flash')
const session = require('express-session')
const cookieParser = require('cookie-parser')
const bodyParser = require('body-parser')
const socketio = require('socket.io')
const ObjectID = require('mongodb').ObjectID;
const AccountFaculty = require('./models/AccountFacultyModel')
const AccountAdmin = require('./models/AccountAdminModel')
const Notification = require('./models/NotificationModel')
const AccountStudent = require('./models/AccountStudentModel')
const Comment = require('./models/CommentModel')
const mongoose = require('mongoose')

const app = express()
const KhoaRouter = require('./routers/khoa')
const StudentRouter = require('./routers/student')
const {OAuth2Client} = require('google-auth-library');
const ContentPost = require('./models/ContentModel')
const CLIENT_ID = '192862003971-e3ne3er14ijgit447n760d6vsbcrq6g2.apps.googleusercontent.com'
const client = new OAuth2Client(CLIENT_ID);
const multer = require('multer')
const upload = multer({dest: 'uploads'})
app.set('view engine','ejs')
app.use(bodyParser.urlencoded({extended: false}))
app.use(express.json())
app.use(express.static(__dirname + '/stylesheets'))
app.use('/static',express.static('./static'))
app.use(bodyParser.json())
app.use(cookieParser('giangduong'))
app.use(session({cookie: {maxAge: 60000}}))
app.use(flash())
app.use('/khoa',KhoaRouter)
app.use('/student',StudentRouter)
app.get('/', (req, res) =>{
    const error = req.flash('error') || ''
    const email = req.flash('email') || ''
    const password = req.flash('password') || ''
    res.render('LoginForm', {error, email, password})
})
app.get('/newfeed', (req, res) =>{
    if(!req.session.user){
        return res.redirect('/')
    }
    let name = req.session.user
    
    Notification.find({})
    .then(p=>{
        ContentPost.find({})
        .then(c=>{
                res.render('newfeed',{name:name,notifications:p, data:c})       
        })
    }) 
})

app.get('/posts/:id',(req,res)=>{
    let {id} = req.params
    ContentPost.findById({_id:ObjectID(id)})
    .then(content=>{
        Comment.find({idPost:id})
        .then(c=>{
            if(!c){
                console.log('Không có bình luận')
                return  res.render('postDetail',{name:req.session.user,data:content,comment:''})
            }
            console.log(c)
            return res.render('postDetail',{name:req.session.user,data:content,comment:c})
        })
        
    })
   
})
app.post('/do-comment',(req,res)=>{
    let result=''
    req.on('data',d=>result+=d.toString())
    req.on('end',()=>{
        let data = JSON.parse(result)
        let name = data.name.trim()
        var d = new Date();
        var n = d.toLocaleString();
        AccountFaculty.findOne({email:name})
        .then(p=>{
            if(p){
                var comment = new Comment({
                    email: name,
                    name:p.name,
                    contextPost: data.comment,
                    datePost:n,
                    idPost:data.idPost
                })
                comment.save()
                return res.json({code:0,message:"Comment thành công",comment:comment})
            }else{
                AccountStudent.findOne({email:name})
                .then(s=>{
                    if(s){
                        var comment = new Comment({
                            email: name,
                            name:s.name,
                            contextPost: data.comment,
                            datePost:n,
                            idPost:data.idPost
                        })
                        comment.save()
                        return res.json({code:0,message:"Comment thành công",comment:comment})
                    }else{
                        return res.json({code:1,message:"Comment thất bại"})
                    }
                })
            }
        })
    })
    
})
app.post('/checkemail',(req,res)=>{
    let result=''
    req.on('data',d=>result+=d.toString())
    req.on('end',()=>{
        let email = JSON.parse(result)
        console.log(email)
        AccountFaculty.findOne({email:email})
        .then( p=>{
            if(p){
                res.json({code:0,message:'faculty'})
            }else{
                AccountStudent.findOne({email:email})
                .then(s=>{
                    if(s){
                        res.json({code:0,message:'student'})
                    }else{
                        res.json({code:0,message:'admin'})
                    }
                })
            }
        })
        
    })
    
})
const validatorlogin = [

    check('email').exists().withMessage('Vui lòng nhập email')
    .notEmpty().withMessage('Không được để trống email')
    .isEmail().withMessage('Đây không phải là email hợp lệ'),

    check('password').exists().withMessage('Vui lòng nhập mật khẩu')
    .notEmpty().withMessage('Không được để trống mật khẩu')
    .isLength({min: 6}).withMessage('Mật khẩu phải từ 6 ký tự'),
]

app.get('/logout', (req, res) =>{
    req.session.user = null
    res.clearCookie('session-token')
    res.redirect("/")
})
app.get('/thongbao/:id',(req,res)=>{
    let id=(req.params)
    Notification.findOne({_id: ObjectID(id.id)})
    .then(p=>{
        if(p){

           res.render('detailnotification',{p:p})
        }else{
            console.log('khong tim thay')
        }
    })
    .catch(e=>console.log(e))
})
app.get('/admin', (req,res) =>{
    if(!req.session.user){
        return res.redirect('/')
    }
    AccountFaculty.find({})
    .then(p=>{console.log(p)})
    res.render('adminInterface')
})
app.post('/', validatorlogin, (req, res) =>{
    if(req.session.user){
        return res.redirect('/')
    }
    let result = validationResult(req);
    if(result.errors.length === 0){
        let {email, password} = req.body
        let account = undefined
        if(email === "admin@gmail.com" && password==="123456"){
            req.session.user='admin'
            let name= req.session.user
            return res.redirect('/admin')
        }    
        else{
            AccountFaculty.findOne({email:email})
            .then( p=>{
                if(!p){
                    message ="Tài khoản không tồn tại"
                    req.flash('error', message)
                    return res.redirect('/')
                }else{
                    account=p
                    bcrypt.compare(password,p.password,(err,result)=>{
                        if(result!==true){
                            message ="Tài khoản không tồn tại"
                            req.flash('error', message)
                            return res.redirect('/')
                        }else{
                            delete p.password
                            req.session.user = p.email
                            console.log("Gia tri session: ",req.session.user)
                            return res.redirect('/newfeed')
                        }
                    })
                }
            })
            .catch(e =>{console.log(e)})
        }
    }
    else{
        result = result.mapped()
        let message;
        for (fields in result){
            message = result[fields].msg
            break;
        }
        const {email, password} = req.body
        req.flash('error', message)
        req.flash('email', email)
        req.flash('password', password)
        res.redirect('/')
    }
})
app.get('/admin/create_account',(req,res) =>{
    const error = req.flash('error') || ''
    const name = req.flash('name') || ''
    const email = req.flash('email') || ''
    const password = req.flash('password') || ''
    res.render('register', {error, name, email, password})
})
app.post('/loginGG', (req, res) =>{
    let token = req.body.token;
    async function verify() {
        const ticket = await client.verifyIdToken({
            idToken: token,
            audience: CLIENT_ID
        });
        const payload = ticket.getPayload();
        const userid = payload['sub'];
        console.log(payload)
        const domain = payload['hd'];
      }
      verify()
      .then(() =>{
        res.cookie('session-token', token)
        res.send('success')
      })
      .catch(console.error);
})
app.get('/stu',checkAuthentication, (req, res) =>{
    let user = req.user;
    req.session.user = user.email
    if(user.hd == "student.tdtu.edu.vn"){
        let stu = new AccountStudent({
            name: user.name,
            email: user.email,
            clas: "",
            faculty: "",
            picture: user.picture
        })
        stu.save()

        return res.redirect('/newfeed'); 
    }
    else {
        return res.redirect('/')
    }


})

const validatorRegis = [
    check('name').exists().withMessage('Vui lòng nhập tên của văn phòng/khoa')
    .notEmpty().withMessage('Không được để trống tên của văn phòng/khoa'),

    check('email').exists().withMessage('Vui lòng nhập email')
    .notEmpty().withMessage('Không được để trống email')
    .isEmail().withMessage('Đây không phải là email hợp lệ'),

    check('password').exists().withMessage('Vui lòng nhập mật khẩu')
    .notEmpty().withMessage('Không được để trống mật khẩu')
    .isLength({min: 6}).withMessage('Mật khẩu phải từ 6 ký tự'),

    check('rePassword').exists().withMessage('Vui lòng nhập xác nhận mật khẩu')
    .notEmpty().withMessage('Vui lòng nhập xác nhận mật khẩu')
    .custom((value, {req}) =>{
        if(value !== req.body.password){
            throw new Error('Mật khẩu không khớp')
        }
        return true;
    })
]
app.get('/logout',(req,res)=>{
    req.session.user = null
    res.redirect('/')
})
app.get('/allthongbao/:page',(req,res)=>{
    let perPage = 10; // số lượng sản phẩm xuất hiện trên 1 page
    let page = req.params.page || 1; 
    Notification
      .find() // find tất cả các data
      .skip((perPage * page) - perPage) // Trong page đầu tiên sẽ bỏ qua giá trị là 0
      .limit(perPage)
      .exec((err, notifications) => {
        Notification.countDocuments((err, count) => { // đếm để tính có bao nhiêu trang
          if (err) return next(err);
           res.render('notification',{notifications,current:page,pages:Math.ceil(count/perPage)}) // Trả về dữ liệu các sản phẩm theo định dạng như JSON, XML,...
        });
      });
})
app.get('/thongbao/:id',(req,res)=>{
    let id=(req.params)
    Notification.find({_id: ObjectID(id.id)})
    .then(p=>{
        if(p){
           res.render('detailnotification',{p:p[0]})
        }else{
            console.log('khong tim thay')
        }
    })
    .catch(e=>console.log(e))

})
app.post('/admin/create_account', validatorRegis, (req, res) =>{
    let result = validationResult(req);
    if (result.errors.length === 0){
        let {name, email, password, FAC} = req.body
        var temp = ""
        temp += FAC
        bcrypt.hash(password, 10)
        .then(hashed => {
            let user = new AccountFaculty({
                name: name,
                email: email,
                password: hashed,
                faculity:name,
                permission: temp
            })
            return user.save()
        })
    }
    else{
        result = result.mapped()
        let message;
        for (fields in result){
            message = result[fields].msg
            break;
        }
        const {name, email, password} = req.body
        req.flash('error', message)
        req.flash('name', name)
        req.flash('email', email)
        req.flash('password', password)
        res.redirect('/admin/create_account')
    }
    res.redirect('/admin')
   
})




function checkAuthentication(req, res, next){
    let token = req.cookies['session-token'];
    let user = {};
    async function verify() {
        const ticket = await client.verifyIdToken({
            idToken: token,
            audience: CLIENT_ID
        });
        const payload = ticket.getPayload();
        user.name = payload.name;
        user.email = payload.email;
        user.picture = payload.picture;
        user.hd = payload.hd
    }
    verify()
    .then(() =>{
        req.user = user;
        next()
    })
    .catch(e =>{
        res.redirect('/')
    })
  }

const port = process.env.PORT || 8080

mongoose.connect('mongodb://localhost/accountfaculty', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useFindAndModify: false
})
.then(() =>{
        const httpServer = app.listen(port,()=>console.log('http://localhost:'+port))
        const io = socketio(httpServer)
        io.on('connection',client=>{
            client.free= true
            client.loginAt=new Date().toLocaleDateString()
            console.log(`Client ${client.id} connected`)
            let users= Array.from(io.sockets.sockets.values()).map(socket=>({id:socket.id, username: socket.username, free: socket.loginAt, free:socket.free}))
            console.log(users)
            client.on('disconnect',()=>{
                console.log(`${client.id} has left`)  
                client.broadcast.emit('user-leave', client.id)
                 }
            )
            client.on('notify',n=>{
                console.log(n)
                client.broadcast.emit('alertNoti',{message:`Có thông báo mới:<a href="/thongbao/${n}">Xem chi tiết</a>`})
            })
            client.on('new-post',(data)=>{
                client.broadcast.emit("new-post",data)
            })
            client.on("new-comment", data=>{
                io.emit("new-comment",data)
            })
        })
})
.catch(e => console.log('Không thể kết nối đến database: ' +e.message))

//CHECK EMAIL