import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { v4 as uuidv4 } from 'uuid'; // Import uuid for unique file names

const formSchema = z.object({
  backgroundImageUrl: z.string().nullable().optional(), // No longer strictly a URL for input, but will store URL
  backgroundColor: z.string().min(1, "Warna latar belakang tidak boleh kosong.").default("#0A0A0A"),
  screensaverIdleMinutes: z.coerce.number().int().min(1, "Durasi screensaver harus minimal 1 menit.").default(5),
});

type DisplaySettingsFormValues = z.infer<typeof formSchema>;

const DisplaySettings: React.FC = () => {
  const form = useForm<DisplaySettingsFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      backgroundImageUrl: null,
      backgroundColor: "#0A0A0A",
      screensaverIdleMinutes: 5,
    },
  });

  const { handleSubmit, register, setValue, formState: { isSubmitting, errors } } = form;
  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null);

  useEffect(() => {
    const fetchSettings = async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("background_image_url, background_color, screensaver_idle_minutes")
        .eq("id", 1)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error("Error fetching display settings:", error);
        toast.error("Gagal memuat pengaturan tampilan.");
      } else if (data) {
        setValue("backgroundImageUrl", data.background_image_url);
        setCurrentImageUrl(data.background_image_url);
        setValue("backgroundColor", data.background_color || "#0A0A0A");
        setValue("screensaverIdleMinutes", data.screensaver_idle_minutes || 5);
      }
    };
    fetchSettings();
  }, [setValue]);

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const fileExtension = file.name.split('.').pop();
    const fileName = `${uuidv4()}.${fileExtension}`; // Generate unique file name
    const filePath = `backgrounds/${fileName}`; // Path inside the bucket

    const uploadToastId = toast.loading("Mengunggah gambar latar belakang...");

    try {
      const { data, error } = await supabase.storage
        .from('images') // Use 'images' bucket
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false, // Do not upsert, create new file
        });

      if (error) {
        throw error;
      }

      const { data: publicUrlData } = supabase.storage
        .from('images')
        .getPublicUrl(filePath);

      if (publicUrlData?.publicUrl) {
        setValue("backgroundImageUrl", publicUrlData.publicUrl);
        setCurrentImageUrl(publicUrlData.publicUrl);
        toast.success("Gambar latar belakang berhasil diunggah!", { id: uploadToastId });
      } else {
        throw new Error("Gagal mendapatkan URL publik gambar.");
      }
    } catch (error: any) {
      console.error("Error uploading image:", error);
      toast.error(`Gagal mengunggah gambar: ${error.message}`, { id: uploadToastId });
    }
  };

  const onSubmit = async (values: DisplaySettingsFormValues) => {
    const { data, error } = await supabase
      .from("app_settings")
      .upsert(
        {
          id: 1,
          background_image_url: values.backgroundImageUrl || null,
          background_color: values.backgroundColor,
          screensaver_idle_minutes: values.screensaverIdleMinutes,
        },
        { onConflict: "id" }
      );

    if (error) {
      console.error("Error saving display settings:", error);
      toast.error("Gagal menyimpan pengaturan tampilan.");
    } else {
      toast.success("Pengaturan tampilan berhasil disimpan!");
      console.log("Display settings saved:", data);
    }
  };

  return (
    <Card className="bg-gray-800 text-white border-gray-700">
      <CardHeader>
        <CardTitle className="text-2xl font-semibold text-blue-300">Pengaturan Tampilan</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-gray-400 mb-4">Atur gambar atau warna latar belakang untuk tampilan utama.</p>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="backgroundImageUpload" className="text-gray-300">Unggah Gambar Latar Belakang (Opsional)</Label>
            <Input
              id="backgroundImageUpload"
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="bg-gray-700 border-gray-600 text-white mt-1 file:text-white file:bg-blue-600 file:hover:bg-blue-700 file:border-none file:rounded-md file:px-3 file:py-1"
            />
            {currentImageUrl && (
              <div className="mt-2">
                <p className="text-sm text-gray-400 mb-1">Gambar saat ini:</p>
                <img src={currentImageUrl} alt="Current Background" className="max-w-full h-32 object-contain rounded-md border border-gray-600" />
              </div>
            )}
            {errors.backgroundImageUrl && <p className="text-red-400 text-sm mt-1">{errors.backgroundImageUrl.message}</p>}
          </div>
          <div>
            <Label htmlFor="backgroundColor" className="text-gray-300">Warna Latar Belakang (Hex atau Nama Warna)</Label>
            <Input
              id="backgroundColor"
              type="text"
              {...register("backgroundColor")}
              className="bg-gray-700 border-gray-600 text-white mt-1"
              placeholder="Contoh: #0A0A0A atau black"
            />
            {errors.backgroundColor && <p className="text-red-400 text-sm mt-1">{errors.backgroundColor.message}</p>}
          </div>
          <div>
            <Label htmlFor="screensaverIdleMinutes" className="text-gray-300">Durasi Idle Screensaver (menit)</Label>
            <Input
              id="screensaverIdleMinutes"
              type="number"
              {...register("screensaverIdleMinutes")}
              className="bg-gray-700 border-gray-600 text-white mt-1"
              placeholder="Contoh: 5"
            />
            {errors.screensaverIdleMinutes && <p className="text-red-400 text-sm mt-1">{errors.screensaverIdleMinutes.message}</p>}
          </div>
          <Button type="submit" disabled={isSubmitting} className="w-full bg-blue-600 hover:bg-blue-700 text-white">
            {isSubmitting ? "Menyimpan..." : "Simpan Pengaturan Tampilan"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default DisplaySettings;