'use client'

import * as z from 'zod';
import { Form, FormField, FormControl, FormItem, FormLabel, FormDescription, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from '@/components/ui/input';

import { useRef, useState, useTransition, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { MyAuthSettingsSchema } from '@/schemas';
import { settings } from "@/actions/settings";
import { useCurrentUser } from '@/hooks/use-current-user';
import { MyFormError } from '@/components/uicustom/forms/form-error';
import { MyFormSuccess } from '@/components/uicustom/forms/form-sucess';
import { UserRole } from '@prisma/client';
import { useUiPreferences } from '@/components/providers/ui-preferences';

const LOG_PREFIX = '[frontend/app/(protected)/nexus/page.tsx]'
const MyProtectedSettings = () => {
  const user = useCurrentUser();
  const { prefs, setPrefs, resetPrefs } = useUiPreferences();
  const formRef = useRef<HTMLFormElement>(null);
  const { update } = useSession();

  const [error, setError] = useState<string | undefined>()
  const [success, setSuccess] = useState<string | undefined>()
  const [isPending, startTransition] = useTransition();
  const [isEditing, setIsEditing] = useState(false);
  const [image, setImage] = useState<any>(undefined);
  const [imagePreview, setImagePreview] = useState<any>(undefined);
  
  const form = useForm<z.infer<typeof MyAuthSettingsSchema>>({
    resolver: zodResolver(MyAuthSettingsSchema),
    defaultValues: {
      name: user?.name || undefined,
      email: user?.email || undefined,
      password: undefined,
      newPassword: undefined,
      role: user?.role || undefined,
      isTwoFactorEnabled: user?.isTwoFactorEnabled || undefined,
    }
  });

  // Watch the newPassword field
  const newPassword = useWatch({
    control: form.control,
    name: "newPassword", // specify the name of the field you want to watch
  });

  // Function to clear the password field
  const clearPasswordField = () => {
    form.setValue("password", ""); // Clear the password field
  };

  const onSubmit = (values: z.infer<typeof MyAuthSettingsSchema>) => {
    startTransition( () => { settings(values).then((data) => {
      if (data.error){
        setError(data.error);
      }
      if (data.success){
        update();
        setSuccess(data.success);
        setIsEditing(false)
      }
    })
  });
  };

  const handleStartEdit = () => {
    console.log('clicked edit')
    setIsEditing(!isEditing);
    resetErrors()
  };
  const handleCancelEdit = () => {
    form.reset();
    setIsEditing(false);
    // setShowInput(false);
    setImagePreview(null);
    resetErrors();
  };

  const resetErrors = () => {
    if (error !== '' || success !== ''){
      // Clear any existing error messages when starting to edit
      setError('');
      setSuccess('');
    }
  }

  return(
    <div className={`flex flex-col justify-center items-center gap-4 bg-white/10 dark:bg-secondary/10 p-4 rounded-lg`}>
      {user && <Card className="w-full max-w-[600px] bg-white dark:bg-zinc-900/20 border-black/10" >
        <CardHeader>
          <p className="text-xl font-semibold text-center">User Settings</p>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form
              className='space-y-6 flex flex-col justify-center items-center'
              onSubmit={form.handleSubmit(onSubmit)}
              ref={formRef}
              
            >
              <div className='space-y-4 w-full'>
                <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          disabled={isPending || !isEditing}
                          placeholder={`${user?.name ? user.name : 'Choose a name' }`}
                          className='bg-slate-100 dark:bg-slate-950/50 border-black/60 focus:border-sky-400/60 dark:border-white/60 dark:focus:border-sky-600/60 no-underline'
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {!user?.isOAuth && 
                <>
                  <FormField control={form.control} name="email" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            disabled={isPending || !isEditing}
                            placeholder="Example@mail.com"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {newPassword && <FormField control={form.control} name="password" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            disabled={isPending || !isEditing}
                            placeholder="******"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />}
                  <FormField control={form.control} name="newPassword" render={({ field }) => (
                      <FormItem>
                        <FormLabel>New Password</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            disabled={isPending || !isEditing}
                            placeholder="******"
                            onChange={(e) => {
                              field.onChange(e); // Call the original onChange
                              if (e.target.value === "") clearPasswordField();
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
                }
                {user && user.role === UserRole.ADMIN ? <FormField control={form.control} name="role" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Role</FormLabel>
                      <Select
                        disabled={isPending || !isEditing || user?.role !== UserRole.ADMIN} 
                        onValueChange={field.onChange}
                        value={isEditing? field.value : user?.role}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger className='disabled:pointer-events-none bg-slate-100 dark:bg-slate-950/50 border-black/60 focus:border-sky-400/60 dark:border-white/60 dark:focus:border-sky-600/60 no-underline'>
                            <SelectValue placeholder='Select a role' />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className='bg-slate-100 dark:bg-slate-900 dark:border-white/60' >
                          <SelectItem value={UserRole.ADMIN}>
                            Admin
                          </SelectItem>
                          <SelectItem value={UserRole.USER}>
                            User
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                /> : <FormMessage />}
                {!user?.isOAuth && <FormField control={form.control} name="isTwoFactorEnabled" render={({ field }) => (
                    <FormItem className='flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm'>
                      <div className='space-y-0.5'>
                        <FormLabel>Two Factor Authentication</FormLabel>
                        <FormDescription>Enable Two Factor Authentication</FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          className={``}
                          disabled={isPending || !isEditing}
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />}
              </div>
              <div className={`w-full`}>
                {isEditing ? (
                  <div className={`space-y-2`}>
                    <button onClick={form.handleSubmit(onSubmit)} disabled={isPending} type='submit' className={`w-full bg-white/50 dark:bg-black/50 text-black dark:text-white py-1 text-center transition duration-300 hover:scale-95 rounded group hover:bg-emerald-300/50 dark:hover:bg-emerald-600/50 ${!isEditing ? 'w-fit bg-emerald-500/50 dark:bg-emerald-500/50' : 'w-fit'}`}>
                      {isPending ? 'Loading...' : 'Save'}
                    </button>
                    <div onClick={handleCancelEdit} className={`w-full bg-white/50 dark:bg-black/50 text-black dark:text-white py-2 text-center transition duration-300 hover:scale-95 rounded group hover:bg-red-300/50 dark:hover:bg-red-600/50 ${!isEditing ? 'w-fit bg-emerald-500/50 dark:bg-emerald-500/50' : 'w-fit'}`}>
                      <div className="w-full px-2 text-sm group-hover:font-semibold group-hover:cursor-pointer">{`${isEditing ? `Cancel Edit` : `Enable edit`}`}</div>
                    </div>
                  </div>
                  ) : (
                  <div onClick={handleStartEdit} className={`w-full bg-black/50 dark:bg-black/50 text-white dark:text-white py-2 text-center transition duration-300 hover:scale-95 rounded group hover:bg-emerald-500 dark:hover:bg-emerald-600 ${!isEditing ? 'w-fit bg-emerald-400/50 dark:bg-emerald-500/50' : 'w-fit'}`}>
                    <div className="w-full px-2 text-sm group-hover:font-semibold group-hover:cursor-pointer">Enable edit</div>
                  </div>
                  )
                }
              </div>
              <MyFormError message={error} />
              <MyFormSuccess message={success} />
            </form>
          </Form>
        </CardContent>
      </Card>}

      {user && (
        <Card className="w-full max-w-[600px] bg-white dark:bg-zinc-900/20 border-black/10">
          <CardHeader>
            <p className="text-xl font-semibold text-center">Experience</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">Extra fancy product title (RSVP)</p>
                <p className="text-xs text-muted-foreground">
                  Optional rapid word reveal on product pages. Respects reduced-motion.
                </p>
              </div>
              <Switch
                checked={prefs.productTitleAnimationMode === 'rsvp'}
                onCheckedChange={(checked) =>
                  setPrefs({ productTitleAnimationMode: checked ? 'rsvp' : 'letters' })
                }
              />
            </div>

            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">Reset UI preferences</p>
              <Button type="button" variant="secondary" onClick={resetPrefs}>
                Reset
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
export default MyProtectedSettings; // this needs to be default because its in a (protected) route and is a page.tsx