import express from "express";
import bodyParser from "body-parser";
import ejs from "ejs";
import session from "express-session";
import { fileURLToPath } from "url";
import path from "path";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import multer from 'multer';
import cloudinary from 'cloudinary';
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = multer.diskStorage({});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

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


app.get("/admin/delete-room/:id",async(req,res)=>{
  
  const {data,error}=await supabase.from("reviews").delete().eq("review_id",req.params.id);
  console.log("REVIEW DELETED !!!")
  return res.redirect("/admin/dashboard");
})
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

app.post("/update-room-details/:id", upload.single("image"), async(req,res)=>{

  const {hostel_id,room_type,price_veg,price_non_veg,price_special,price_veg_nri,price_non_veg_nri,price_special_nri}=req.body;
  let image = null;

    if (req.file) {
        const uploadResult = await cloudinary.uploader.upload(req.file.path, {
          folder: "room_images",
          resource_type: "image",
        });
        image = uploadResult.secure_url;

         const {data:roomdetailsdata,error:roomdetailserror}=await supabase.from("room_details").update({

price_veg,
price_non_veg,
price_special,
price_veg_nri,
price_non_veg_nri,
price_special_nri,
image,

  }).eq("room_detail_id",req.params.id);


      }

  const {data:roomdetailsdata,error:roomdetailserror}=await supabase.from("room_details").update({

price_veg,
price_non_veg,
price_special,
price_veg_nri,
price_non_veg_nri,
price_special_nri,


  }).eq("room_detail_id",req.params.id);
      return res.redirect(`/admin/manage-hostel/${hostel_id}`);

})


app.post(
  "/publish-room-details",
  upload.single("image"),
  async (req, res) => {
    try {
      const {
        hostel_id,
        room_type,
        price_veg,
        price_non_veg,
        price_special,
        price_veg_nri,
        price_non_veg_nri,
        price_special_nri,
      } = req.body;

      let imageUrl = null; // ✅ declare first

      // upload image if provided
      if (req.file) {
        const uploadResult = await cloudinary.uploader.upload(req.file.path, {
          folder: "room_images",
          resource_type: "image",
        });
        imageUrl = uploadResult.secure_url;
      }

      // insert into database
      const { error } = await supabase
        .from("room_details")
        .insert({
          hostel_id,
          room_type,
          price_veg,
          price_non_veg,
          price_special,
          price_veg_nri,
          price_non_veg_nri,
          price_special_nri,
          image: imageUrl,
        });

      if (error) throw error;

      return res.redirect("/admin/dashboard");
    } catch (error) {
      console.error(error);
      res.status(500).send(error.message);
    }
  }
);

app.post(
  "/save-room-details",
  upload.array("images"),
  async (req, res) => {
    try {
      const {
        hostel_id,
        room_detail_id,
        room_type,
        price_veg,
        price_non_veg,
        price_special,
        price_veg_nri,
        price_non_veg_nri,
        price_special_nri,
        current_image,
      } = req.body;

      const toArray = (value) => {
        if (Array.isArray(value)) return value;
        if (typeof value === "undefined") return [];
        return [value];
      };

      const roomDetailIds = toArray(room_detail_id);
      const roomTypes = toArray(room_type);
      const priceVeg = toArray(price_veg);
      const priceNonVeg = toArray(price_non_veg);
      const priceSpecial = toArray(price_special);
      const priceVegNri = toArray(price_veg_nri);
      const priceNonVegNri = toArray(price_non_veg_nri);
      const priceSpecialNri = toArray(price_special_nri);
      const currentImages = toArray(current_image);
      const files = req.files || [];

      for (let i = 0; i < roomTypes.length; i += 1) {
        let imageUrl = null;

        if (files[i]) {
          const uploadResult = await cloudinary.uploader.upload(files[i].path, {
            folder: "room_images",
            resource_type: "image",
          });
          imageUrl = uploadResult.secure_url;
        }

        if (roomDetailIds[i]) {
          const updateData = {
            price_veg: priceVeg[i],
            price_non_veg: priceNonVeg[i],
            price_special: priceSpecial[i],
            price_veg_nri: priceVegNri[i],
            price_non_veg_nri: priceNonVegNri[i],
            price_special_nri: priceSpecialNri[i],
          };

          if (imageUrl) {
            updateData.image = imageUrl;
          }

          const { error } = await supabase
            .from("room_details")
            .update(updateData)
            .eq("room_detail_id", roomDetailIds[i]);

          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("room_details")
            .insert({
              hostel_id,
              room_type: roomTypes[i],
              price_veg: priceVeg[i],
              price_non_veg: priceNonVeg[i],
              price_special: priceSpecial[i],
              price_veg_nri: priceVegNri[i],
              price_non_veg_nri: priceNonVegNri[i],
              price_special_nri: priceSpecialNri[i],
              image: imageUrl || currentImages[i] || null,
            });

          if (error) throw error;
        }
      }

      return res.redirect(`/admin/manage-hostel/${hostel_id}`);
    } catch (error) {
      console.error(error);
      res.status(500).send(error.message);
    }
  }
);

app.post("/add-new-floor", upload.array("floor_images"), async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.redirect("/");
  }

  const hostelid = req.body.hostelid;
  const floorCount = Number.parseInt(req.body.floor_count, 10);
  const files = req.files || [];

  if (!floorCount || floorCount < 1) {
    return res.redirect(`/admin/${hostelid}/new-floor`);
  }

  const ordinal = [
    "Ground",
    "First",
    "Second",
    "Third",
    "Fourth",
    "Fifth",
    "Sixth",
    "Seventh",
    "Eighth",
    "Ninth",
    "Tenth",
    "Eleventh",
    "Twelfth",
    "Thirteenth",
    "Fourteenth",
    "Fifteenth",
    "Sixteenth",
    "Seventeenth",
    "Eighteenth",
    "Nineteenth",
    "Twentieth",
  ];

  const getFloorName = (index) => {
    if (index < ordinal.length) return `${ordinal[index]} Floor`;
    return `${index + 1}th Floor`;
  };

  try {
    for (let i = 0; i < floorCount; i += 1) {
      let imageUrl = null;

      if (files[i]) {
        const uploadResult = await cloudinary.uploader.upload(files[i].path, {
          folder: "floor_plans",
          resource_type: "image",
        });
        imageUrl = uploadResult.secure_url;
      }

      const { error } = await supabase.from("floor_plans").insert({
        hostel_id: hostelid,
        floor: getFloorName(i),
        link: imageUrl,
      });

      if (error) throw error;
    }

    return res.redirect(`/admin/manage-hostel/${hostelid}`);
  } catch (error) {
    console.error(error);
    return res.status(500).send(error.message);
  }
});

app.post("/add-new-block", async (req, res) => {
  const { block, gender, type, beds, btype, mess_caterer,veg_mess_floor,non_veg_mess_floor,special_mess_floor,badminton_court,chota_dhobi } = req.body;
  const { data, error } = await supabase.from("hostels").insert({
    hostel_name: block,
    gender: gender,
    hostel_type:type,
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

app.post(
  "/modify-floor-plan",
  upload.single("image"),
  async (req, res) => {
    try {
      const { floor_id, hostel_id } = req.body;

      let imageUrl = null; // ✅ declare outside

      // upload image if provided
      if (req.file) {
        const uploadResult = await cloudinary.uploader.upload(req.file.path, {
          folder: "floor_plans",
          resource_type: "image",
        });
        imageUrl = uploadResult.secure_url;
      }

      // prepare update object
      const updateData = {};
      if (imageUrl) updateData.link = imageUrl;

      // update DB
      const { error } = await supabase
        .from("floor_plans")
        .update(updateData)
        .eq("id", floor_id);

      if (error) throw error;

      return res.redirect(`/admin/manage-hostel/${hostel_id}`);
    } catch (error) {
      console.error(error);
      res.status(500).send(error.message);
    }
  }
);


app.get("/admin/manage-hostel/:id", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.redirect("/");
  }

  const {data:roomdetailsdata,error:roomdetailserror}=await supabase.from("room_details").select("*").eq("hostel_id",req.params.id);
  
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
    .from("reviews")
    .select("*")
    .eq("hostel_id", hosteldata.hostel_id);
  return res.render("admin/manage-hostels.ejs", {
    hosteldata,
    floordata,
    roomdata,
    roomdetailsdata,
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
