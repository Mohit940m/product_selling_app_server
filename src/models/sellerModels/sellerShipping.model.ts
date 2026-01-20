import mongoose, { Schema, Document } from "mongoose";

// Helper: Mapping States to Regions for "Same Region" logic
const STATE_REGION_MAPPING: Record<string, string> = {
  // North
  "jammu and kashmir": "north", "himachal pradesh": "north", "punjab": "north", 
  "chandigarh": "north", "uttarakhand": "north", "haryana": "north", "delhi": "north", 
  "ladakh": "north",
  
  // Central
  "uttar pradesh": "central", "madhya pradesh": "central", "chhattisgarh": "central",

  // West
  "rajasthan": "west", "gujarat": "west", "maharashtra": "west", "goa": "west", 
  "dadra and nagar haveli and daman and diu": "west",

  // East
  "bihar": "east", "jharkhand": "east", "west bengal": "east", "odisha": "east",

  // South
  "telangana": "south", "andhra pradesh": "south", "karnataka": "south", 
  "kerala": "south", "tamil nadu": "south", "puducherry": "south",

  // North East
  "sikkim": "north-east", "assam": "north-east", "meghalaya": "north-east", 
  "arunachal pradesh": "north-east", "nagaland": "north-east", "manipur": "north-east", 
  "mizoram": "north-east", "tripura": "north-east"
};

// Remote areas (Islands)
const REMOTE_AREAS = ["andaman and nicobar islands", "lakshadweep"];

export interface IShippingZone {
  cost: number;
  time: string; // e.g. "3-5 Days"
}

export interface ISellerShippingDocument extends Document {
  sellerId: mongoose.Types.ObjectId;
  origin: {
    city: string;
    state: string;
    region?: string;
  };
  shippingRates: {
    sameCity: IShippingZone;
    sameState: IShippingZone;
    sameRegion: IShippingZone;
    restOfIndia: IShippingZone;
    remote: IShippingZone;
  };
  // Method to calculate shipping based on destination
  calculateShipping(destination: { city: string; state: string }): { cost: number; time: string; type: string };
}

const shippingZoneSchema = new Schema<IShippingZone>({
  cost: { type: Number, required: true, default: 0 },
  time: { type: String, required: true, default: "5-7 Days" }
}, { _id: false });

const sellerShippingSchema = new Schema<ISellerShippingDocument>(
  {
    sellerId: {
      type: Schema.Types.ObjectId,
      ref: "Seller",
      required: true,
      unique: true,
    },
    origin: {
      city: { type: String, required: true, lowercase: true, trim: true },
      state: { type: String, required: true, lowercase: true, trim: true },
      region: { type: String, lowercase: true, trim: true },
    },
    shippingRates: {
      sameCity: { type: shippingZoneSchema, required: true },
      sameState: { type: shippingZoneSchema, required: true },
      sameRegion: { type: shippingZoneSchema, required: true },
      restOfIndia: { type: shippingZoneSchema, required: true },
      remote: { type: shippingZoneSchema, required: true },
    },
  },
  { timestamps: true }
);

// Pre-save: Automatically determine region from state if not provided
sellerShippingSchema.pre("save", async function () {
  if (!this.isModified("origin.state") || this.origin.region) {
    return; // Skip if state is not modified or region is already set
  }

  const stateLower = this.origin.state.toLowerCase();
  this.origin.region = STATE_REGION_MAPPING[stateLower] || "rest";
});

// Method: Smart calculation logic
sellerShippingSchema.methods.calculateShipping = function(destination: { city: string; state: string }) {
  const destCity = destination.city?.toLowerCase().trim();
  const destState = destination.state?.toLowerCase().trim();
  
  const originCity = this.origin.city; // stored as lowercase
  const originState = this.origin.state; // stored as lowercase
  const originRegion = this.origin.region;

  const format = (zone: IShippingZone, type: string) => ({
    cost: zone.cost,
    time: zone.time,
    type
  });

  // 1. Remote Check (Islands)
  if (REMOTE_AREAS.includes(destState)) {
    return format(this.shippingRates.remote, "remote");
  }

  // 2. Same City
  if (destCity === originCity && destState === originState) {
    return format(this.shippingRates.sameCity, "sameCity");
  }

  // 3. Same State
  if (destState === originState) {
    return format(this.shippingRates.sameState, "sameState");
  }

  // 4. Same Region
  const destRegion = STATE_REGION_MAPPING[destState];
  if (originRegion && destRegion && originRegion === destRegion) {
    return format(this.shippingRates.sameRegion, "sameRegion");
  }

  // 5. Default: Rest of India
  return format(this.shippingRates.restOfIndia, "restOfIndia");
};

const SellerShipping = mongoose.model<ISellerShippingDocument>("SellerShipping", sellerShippingSchema);
export default SellerShipping;