
import db from "../db/connection.ts";
import { users } from "../db/schema.ts";
export default function usersController() {
    
  const uploadProfilePic = async (req, res) => {
    const { cdnUrl } = req.body;
    await db.insert(users).values({ ...req.body,
      imgUrl : cdnUrl
    }).returning({ id: users.id,
        email: users.email,
        fname: users.fname,
        lname: users.lname,
        imgUrl: users.imgUrl
      })
    return res.status(200).json({
      message: "Done added to db",
    });
  };


}
