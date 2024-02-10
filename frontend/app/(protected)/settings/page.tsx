'use client'

import * as z from 'zod';
import { Form, FormField, FormControl, FormItem, FormLabel, FormDescription, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from '@/components/ui/input';

import { useState, useTransition } from "react";
import { useSession } from "next-auth/react";
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { MyAuthSettingsSchema } from '@/schemas';
import { settings } from "@/actions/settings";
import { useCurrentUser } from '@/hooks/use-current-user';
import { MyFormError } from '@/components/uicustom/forms/form-error';
import { MyFormSucess } from '@/components/uicustom/forms/form-sucess';
import { UserRole } from '@prisma/client';

const LOG_PREFIX = '[[USE CLIENT] layout.tsx]'
const MyProtectedSettings = () => {
  const user = useCurrentUser();
  const { update } = useSession();


  const [error, setError] = useState<string | undefined>()
  const [success, setSuccess] = useState<string | undefined>()
  const [isPending, startTransition] = useTransition();

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

  const onSubmit = (values: z.infer<typeof MyAuthSettingsSchema>) => {
    startTransition( () => { settings(values).then((data) => {
      if (data.error){
        setError(data.error);
      }
      if (data.success){
        update();
        setSuccess(data.success);
      }
    })
  });
  };

    return(
    <Card className="w-[600px]" >
      <CardHeader>
        <p className="text-xl font-semibold text-center">Settings</p>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            className='space-y-6 flex flex-col justify-center items-center'
            onSubmit={form.handleSubmit(onSubmit)}
          >
            <div className='space-y-4 w-full'>
              <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        disabled={isPending}
                        placeholder="Choose a name"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {!user?.isOAuth && 
              <>
              <h1> Yo: {user?.isOAuth ? `${user?.isOAuth}` : `${user?.isOAuth}`} </h1>
                <FormField control={form.control} name="email" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          disabled={isPending}
                          placeholder="Example@mail.com"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField control={form.control} name="password" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          disabled={isPending}
                          placeholder="******"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField control={form.control} name="newPassword" render={({ field }) => (
                    <FormItem>
                      <FormLabel>New Password</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          disabled={isPending}
                          placeholder="******"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
              }
              <FormField control={form.control} name="role" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <Select
                      disabled={isPending} 
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder='Select a role' />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent >
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
              />
              {!user?.isOAuth && <FormField control={form.control} name="isTwoFactorEnabled" render={({ field }) => (
                  <FormItem className='flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm'>
                    <div className='space-y-0.5'>
                      <FormLabel>Two Factor Authentication</FormLabel>
                      <FormDescription>Enable Two Factor Authentication</FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        disabled={isPending}
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />}
            </div>
            <MyFormError message={error} />
            <MyFormSucess message={success} />
            <Button disabled={isPending} type="submit" className='w-40'>Save</Button>
          </form>
        </Form>
      </CardContent>
    </Card>
    )
}
export default MyProtectedSettings; // this needs to be default because its in a (protected) route and is a page.tsx