import express from "express";
import bodyParser from "body-parser";
import ejs from "ejs";
import session from "express-session";
import { fileURLToPath } from "url";
import path from "path";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";

import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);
const app = express();

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
  })
);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static("public"));

app.use(passport.initialize());
app.use(passport.session());

app.get("/", async (req, res) => {
  res.render("admin/auth.ejs");
});

app.get("/logout", (req, res) => {
  req.logout(function (err) {
    if (err) {
      return next(err);
    }
    res.redirect("/");
  });
});

passport.use(
  "google",
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "http://localhost:3000/auth/google/dashboard",
      userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo",
    },
    async (accessToken, refreshToken, profile, cb) => {
      try {
        const result = await supabase
          .from("users")
          .select("*")
          .eq("uid", profile.id)
          .single();
        let user;
        if (!result.data) {
          const { error } = await supabase.from("users").insert([
            {
              uid: profile.id,
              name: profile.displayName,
              email: profile.emails[0].value,
              profile_picture: profile.photos[0].value,
            },
          ]);
          if (error) {
            console.error("Error inserting user:", error);
            return cb(error);
          }
          const { data: newUser, error: fetchError } = await supabase
            .from("users")
            .select("*")
            .eq("uid", profile.id)
            .single();
          if (fetchError) {
            console.error("Fetch after insert failed:", fetchError);
            return cb(fetchError);
          }
          user = newUser;
        } else {
          user = result.data;
        }

        return cb(null, user);
      } catch (err) {
        return cb(err);
      }
    }
  )
);

app.get(
  "/auth/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
  })
);

app.get(
  "/auth/google/dashboard",
  passport.authenticate("google", {
    failureRedirect: "/",
    successRedirect: "/admin/dashboard",
  })
);

app.get("/admin/dashboard", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.redirect("/");
  }

  const { data: hosteldata, error: hostelerror } = await supabase
    .from("hostels")
    .select("*");

  return res.render("admin/dashboard.ejs", {
    hosteldata,
    user: req.session.user,
  });
});

app.get(
  "/admin/manage-hostel/:hostelid/modify-floor/:floorid",
  async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.redirect("/");
    }

    const { data: hosteldata, error: hostelerror } = await supabase
      .from("hostels")
      .select("*")
      .eq("hostel_id", req.params.hostelid)
      .single();

    const { data: floordata, error: floorerror } = await supabase
      .from("floor_plans")
      .select("*")
      .eq("id", req.params.floorid)
      .single();
    res.render("admin/edit-floor-plan.ejs", { hosteldata, floordata });
  }
);

app.get("/admin/delete-hostel/:id", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.redirect("/");
  }

  await supabase.from("hostels").delete().eq("hostel_id", req.params.id);
  res.redirect("/admin/dashboard");
});

app.get("/admin/:hostelid/new-floor", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.redirect("/");
  }

  const { data: hosteldata, error: hostelerror } = await supabase
    .from("hostels")
    .select("*")
    .eq("hostel_id", req.params.hostelid)
    .single();

  res.render("admin/new-floor.ejs", { hosteldata });
});

app.get("/admin/delete-floor/:hostelid/:floorid", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.redirect("/");
  }

  const { data, error } = await supabase
    .from("floor_plans")
    .delete()
    .eq("id", req.params.floorid);
  return res.redirect(`/admin/manage-hostel/${req.params.hostelid}`);
});

app.post("/add-new-floor", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.redirect("/");
  }

  const hostelid = req.body.hostelid;
  const floor = req.body.floor;

  const { data, error } = await supabase.from("floor_plans").insert({
    hostel_id: hostelid,
    floor: floor,
  });
  res.redirect(`/admin/manage-hostel/${hostelid}`);
});

app.post("/add-new-block", async (req, res) => {
  const { block, type, beds, btype, mess_caterer,veg_mess_floor,non_veg_mess_floor,special_mess_floor,badminton_court,chota_dhobi } = req.body;
  const { data, error } = await supabase.from("hostels").insert({
    hostel_name: block,
    hostel_type: type,
    bed_availability: beds,
    bed_type: btype,
    mess_caterer:mess_caterer,
    veg_mess_floor:veg_mess_floor,
    non_veg_mess_floor:non_veg_mess_floor,
    special_mess_floor:special_mess_floor,
    badminton_court:badminton_court,
    chota_dhobi_facility:chota_dhobi
  });

  if(error){
    console.log(error);
  }
  return res.redirect("/admin/dashboard");
});

app.get("/admin/dashboard/new-hostel", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.redirect("/");
  }

  res.render("admin/new-hostel.ejs");
});

app.post("/modify-floor-plan", async (req, res) => {
  const new_image = req.body.new_image;
});

app.get("/admin/manage-hostel/:id", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.redirect("/");
  }

  const { data: hosteldata, error: hostelerror } = await supabase
    .from("hostels")
    .select("*")
    .eq("hostel_id", req.params.id)
    .single();
  const { data: floordata, error: floorerror } = await supabase
    .from("floor_plans")
    .select("*")
    .eq("hostel_id", hosteldata.hostel_id);
  const { data: roomdata, error: roomerror } = await supabase
    .from("rooms")
    .select("*")
    .eq("hostel_id", hosteldata.hostel_id);
  return res.render("admin/manage-hostels.ejs", {
    hosteldata,
    floordata,
    roomdata,
  });
});

app.listen(3000, () => {
  console.log("Running on Port 3000!");
});

passport.serializeUser((user, cb) => {
  cb(null, user);
});

passport.deserializeUser((user, cb) => {
  cb(null, user);
});
