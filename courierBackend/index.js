const express = require("express");
const path = require("path");
const cors = require('cors');
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt=require("bcrypt")
const app = express();
const jwt=require("jsonwebtoken");
app.use(cors());
app.use(express.json());

const dbPath = path.join(__dirname, "courier.db");

let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3009, () => {
      console.log("Server Running at http://localhost:3400/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};

initializeDBAndServer();
const authenticateToken = (request, response, next) => {
    let jwtToken;
    const authHeader = request.headers["authorization"];
    if (authHeader !== undefined) {
      jwtToken = authHeader.split(" ")[1];
    }
    if (jwtToken === undefined) {
      response.status(401);
      response.send("Invalid JWT Token");
    } else {
      jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
        if (error) {
          response.status(401);
          response.send("Invalid JWT Token");
        } else {
            request.username=payload.username;
          next();
        }
      });
    }
  };

app.get("/profile/",authenticateToken,async(request,response)=>{
    let {username}=request;
    
    const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const userDetails = await db.get(selectUserQuery);
  response.send(userDetails);
})
app.post("/users/", async (request, response) => {
    const { username, name, password, location } = request.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
    const dbUser = await db.get(selectUserQuery);
    if (dbUser === undefined) {
      const createUserQuery = `
        INSERT INTO 
          user (username, name, password, location) 
        VALUES 
          (
            '${username}', 
            '${name}',
            '${hashedPassword}', 
           
            '${location}'
          )`;
      const dbResponse = await db.run(createUserQuery);
      const newUserId = dbResponse.lastID;
      response.send(`Created new user with ${newUserId}`);
    } else {
      response.status = 400;
      response.send("User already exists");
    }
  });
app.post("/login", async (request, response) => {
    const { username, password } = request.body;
    const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
    const dbUser = await db.get(selectUserQuery);
    if (dbUser === undefined) {
      response.status(400);
      response.send("Invalid User");
    } else {
      const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
      if (isPasswordMatched === true) {
         const payload={username:username};
         const jwtToken=jwt.sign(payload,"Tracking")
        response.send({jwtToken});
      } else {
        response.status(400);
        response.send("Invalid Password");
      }
    }
  });


app.get("/trackingNumber/:number/",authenticateToken,async(request,response)=>{
    const {number}=request.params
    const TrackDetailsQuery=`SELECT tracking_number, carrier, status, estimated_delivery
    FROM PackageInfo
    WHERE tracking_number = ${number};`;
    const TrackDetail=await db.get(TrackDetailsQuery);
    response.send(TrackDetail)

})

app.get("/events/:trackNumber/",authenticateToken,async(request,response)=>{
     const {trackNumber}=request.params;
     const TrackEventQuery=`SELECT pe.timestamp, pe.event_description, pe.location
     FROM PackageEvents pe
     WHERE pe.tracking_number = ${trackNumber};`
     const Events=await db.all(TrackEventQuery);
     response.send(Events)

})

app.post("/trackingNumber/",authenticateToken,async(request,response)=>{
       const TrackingDetails=request.body;
       const { tracking_number, carrier, status, estimated_delivery}=TrackingDetails;
       const insertPackageInfoQuery = `
       INSERT INTO PackageInfo (tracking_number, carrier, status, estimated_delivery)
       VALUES ('${tracking_number}', '${carrier}', '${status}', '${estimated_delivery}');
     `;
        const dbResponse=await db.run(insertPackageInfoQuery);
        const TrackingId=dbResponse.lastId;
        response.send(TrackingId);

})


app.put("/trackingNumber/:number",authenticateToken, async (request, response) => {

      const { number } = request.params;
      const trackingDetails = request.body;
      const { carrier, status, estimated_delivery } = trackingDetails;
  
      const updateQuery = `
        UPDATE PackageInfo
        SET carrier = ?, status = ?, estimated_delivery = ?
        WHERE tracking_number = ?
      `;
  
      await db.run(updateQuery, [carrier, status, estimated_delivery, number]);
      response.send("TrackingDetails have been successfully updated");
    
  });

app.delete("/trackingNumber/:number",authenticateToken,async(request,response)=>{
    const {number}=request.params;
    const deleteTrackDetailsQuery = `
      DELETE FROM PackageInfo
      WHERE tracking_number = ?
    `;
    await db.run(deleteTrackDetailsQuery, [number]);
    response.send("Track details have been successfully deleted");
})
 app.delete("/events/:trackNumber",authenticateToken,async(request,response)=>{
    const { trackNumber } = request.params;
    const deleteEventsQuery = `
      DELETE FROM PackageEvents
      WHERE tracking_number = ?
    `;
    await db.run(deleteEventsQuery, [trackNumber]);
    response.send("Events have been successfully deleted");
})

  


  