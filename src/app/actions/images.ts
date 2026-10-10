"use server";
/**
 * Admin actions for product photos. The browser already made the photo smaller
 * (ImageManager); the server still checks everything: who is asking, what the file
 * really is, and how big it is.
 */
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/server/auth";
import { addImage, deleteImage, moveImage } from "@/server/images";

export type ImageActionState = { error?: string };

export async function uploadProductImageAction(formData: FormData): Promise<ImageActionState> {
  await requireAdmin();
  const productId = Number(formData.get("productId"));
  const width = Number(formData.get("width"));
  const height = Number(formData.get("height"));
  const file = formData.get("file");
  if (!Number.isInteger(productId) || !(file instanceof Blob)) return { error: "Липсва снимка." };
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 5000 || height > 5000) {
    return { error: "Непознат размер на снимката." };
  }
  try {
    await addImage(productId, new Uint8Array(await file.arrayBuffer()), width, height);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Снимката не се записа." };
  }
  revalidatePath("/", "layout");
  return {};
}

export async function deleteProductImageAction(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("imageId"));
  if (Number.isInteger(id)) await deleteImage(id);
  revalidatePath("/", "layout");
}

export async function moveProductImageAction(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("imageId"));
  const direction = formData.get("direction") === "up" ? "up" : "down";
  if (Number.isInteger(id)) await moveImage(id, direction);
  revalidatePath("/", "layout");
}
